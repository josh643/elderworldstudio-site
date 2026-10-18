using System;
using System.Threading.Tasks;
using Windows.ApplicationModel;
using Windows.ApplicationModel.Core;
using Windows.Data.Json;
using Windows.Foundation;
using Windows.Storage;
using Windows.System;
using Windows.UI.Core;
using Windows.UI.ViewManagement;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace ElderverseShell
{
    public sealed partial class MainPage : Page
    {
        private static readonly int[] RetryDelaysSeconds = { 5, 10, 30, 60 };
        private const string AllowedHost = "office-3d.elderworldstudio.pages.dev";
        private const string OfflinePage = "ms-appx-web:///Offline/offline.html";
        private const string HostBridgeScript = @"(() => {
            const identity = Object.freeze({
                signIn: async () => ({
                    gamertag: 'EWS Tester',
                    xuid: 'EWS-TEST-0001',
                    privileges: Object.freeze({ multiplayer: true, communications: true, childAccount: false, ugc: true })
                })
            });
            Object.defineProperty(window, 'ewsHost', {
                configurable: false,
                enumerable: true,
                value: Object.freeze({ platform: 'xbox', identity })
            });
        })();";

        private readonly DispatcherTimer _retryTimer;
        private Uri _startUri;
        private Uri _offlineUri;
        private bool _coreReady;
        private bool _showingOffline;
        private bool _suspended;
        private bool _retriedAfterProcessFailure;
        private int _retryIndex;

        public MainPage()
        {
            InitializeComponent();

            _retryTimer = new DispatcherTimer();
            _retryTimer.Tick += RetryTimer_Tick;

            Loaded += MainPage_Loaded;
            Application.Current.Suspending += Application_Suspending;
            CoreApplication.Resuming += CoreApplication_Resuming;
            Window.Current.CoreWindow.KeyDown += CoreWindow_KeyDown;
            SystemNavigationManager.GetForCurrentView().BackRequested += BackRequested;
        }

        private async void MainPage_Loaded(object sender, RoutedEventArgs e)
        {
            ApplicationView.GetForCurrentView().SetDesiredBoundsMode(ApplicationViewBoundsMode.UseCoreWindow);
            ApplicationView.GetForCurrentView().RequiresPointerMode = ApplicationViewRequiresPointerMode.WhenRequested;
            ApplicationView.GetForCurrentView().TryEnterFullScreenMode();
            ApplySafeArea();

            try
            {
                var configFile = await Package.Current.InstalledLocation.GetFileAsync("shell.config.json");
                var configText = await FileIO.ReadTextAsync(configFile);
                var config = JsonObject.Parse(configText);
                _startUri = new Uri(config.GetNamedString("startUrl"));
                _offlineUri = new Uri(OfflinePage);
                if (!IsAllowedRemoteNavigation(_startUri))
                    throw new InvalidOperationException("Configured world URL is outside the shell allowlist.");

                await InitializeWorldViewAsync();
            }
            catch (Exception)
            {
                ShowRecoveryPanel("The world could not be started. Retrying…");
                ScheduleRetry();
            }
        }

        private async Task InitializeWorldViewAsync()
        {
            try
            {
                await WorldView.EnsureCoreWebView2Async();
                var core = WorldView.CoreWebView2;
                if (core == null)
                    throw new InvalidOperationException("WebView2 initialization returned no core instance.");

                core.NavigationStarting -= Core_NavigationStarting;
                core.NavigationCompleted -= Core_NavigationCompleted;
                core.ProcessFailed -= Core_ProcessFailed;
                core.NewWindowRequested -= Core_NewWindowRequested;
                core.NavigationStarting += Core_NavigationStarting;
                core.NavigationCompleted += Core_NavigationCompleted;
                core.ProcessFailed += Core_ProcessFailed;
                core.NewWindowRequested += Core_NewWindowRequested;
                await core.AddScriptToExecuteOnDocumentCreatedAsync(HostBridgeScript);
                _coreReady = true;
                RecoveryPanel.Visibility = Visibility.Collapsed;
                WorldView.Visibility = Visibility.Visible;
                NavigateToWorld();
            }
            catch (Exception)
            {
                _coreReady = false;
                ShowRecoveryPanel("The world runtime is unavailable. Retrying…");
                ScheduleRetry();
            }
        }

        private void NavigateToWorld()
        {
            if (!_coreReady || _startUri == null)
                return;

            _showingOffline = false;
            RecoveryPanel.Visibility = Visibility.Collapsed;
            WorldView.Visibility = Visibility.Visible;
            WorldView.CoreWebView2.Navigate(_startUri.AbsoluteUri);
        }

        private void Core_NavigationStarting(
            Microsoft.Web.WebView2.Core.CoreWebView2 sender,
            Microsoft.Web.WebView2.Core.CoreWebView2NavigationStartingEventArgs args)
        {
            if (Uri.TryCreate(args.Uri, UriKind.Absolute, out var target) && IsAllowedNavigation(target))
                return;

            args.Cancel = true;
        }

        private async void Core_NavigationCompleted(
            Microsoft.Web.WebView2.Core.CoreWebView2 sender,
            Microsoft.Web.WebView2.Core.CoreWebView2NavigationCompletedEventArgs args)
        {
            if (!args.IsSuccess)
            {
                await ShowOfflinePageAsync();
                ScheduleRetry();
                return;
            }

            if (Uri.TryCreate(sender.Source, UriKind.Absolute, out var current) && IsAllowedRemoteNavigation(current))
            {
                _showingOffline = false;
                _retriedAfterProcessFailure = false;
                _retryIndex = 0;
                _retryTimer.Stop();
                RecoveryPanel.Visibility = Visibility.Collapsed;
                WorldView.Visibility = Visibility.Visible;
            }
        }

        private void Core_NewWindowRequested(
            Microsoft.Web.WebView2.Core.CoreWebView2 sender,
            Microsoft.Web.WebView2.Core.CoreWebView2NewWindowRequestedEventArgs args)
        {
            args.Handled = true;
        }

        private async void Core_ProcessFailed(
            Microsoft.Web.WebView2.Core.CoreWebView2 sender,
            Microsoft.Web.WebView2.Core.CoreWebView2ProcessFailedEventArgs args)
        {
            if (!_retriedAfterProcessFailure)
            {
                _retriedAfterProcessFailure = true;
                try
                {
                    sender.Reload();
                    return;
                }
                catch (Exception)
                {
                    // Fall through to the bundled recovery screen.
                }
            }

            await ShowOfflinePageAsync();
            ScheduleRetry();
        }

        private bool IsAllowedNavigation(Uri uri)
        {
            if (uri.Scheme.Equals("ms-appx-web", StringComparison.OrdinalIgnoreCase))
                return uri.AbsolutePath.Equals("/Offline/offline.html", StringComparison.OrdinalIgnoreCase);

            return IsAllowedRemoteNavigation(uri) || IsAllowedWorldSocket(uri);
        }

        private static bool IsAllowedRemoteNavigation(Uri uri)
        {
            if (!uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
                !uri.Host.Equals(AllowedHost, StringComparison.OrdinalIgnoreCase) ||
                !uri.IsDefaultPort)
                return false;

            return uri.AbsolutePath.Equals("/office", StringComparison.OrdinalIgnoreCase) ||
                   uri.AbsolutePath.StartsWith("/office/", StringComparison.OrdinalIgnoreCase) ||
                   uri.AbsolutePath.StartsWith("/api/office/", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsAllowedWorldSocket(Uri uri)
        {
            return uri.Scheme.Equals("wss", StringComparison.OrdinalIgnoreCase) &&
                   uri.Host.Equals(AllowedHost, StringComparison.OrdinalIgnoreCase) &&
                   uri.IsDefaultPort &&
                   (uri.AbsolutePath.Equals("/api/office/world", StringComparison.OrdinalIgnoreCase) ||
                    uri.AbsolutePath.StartsWith("/api/office/world/", StringComparison.OrdinalIgnoreCase));
        }

        private async Task ShowOfflinePageAsync()
        {
            if (_suspended || !_coreReady || _offlineUri == null)
            {
                ShowRecoveryPanel("Reconnecting…");
                return;
            }

            _showingOffline = true;
            try
            {
                WorldView.CoreWebView2.Navigate(_offlineUri.AbsoluteUri);
            }
            catch (Exception)
            {
                ShowRecoveryPanel("Reconnecting…");
            }
            await Task.CompletedTask;
        }

        private void ScheduleRetry()
        {
            if (_suspended)
                return;

            var delay = RetryDelaysSeconds[Math.Min(_retryIndex, RetryDelaysSeconds.Length - 1)];
            _retryIndex = Math.Min(_retryIndex + 1, RetryDelaysSeconds.Length - 1);
            _retryTimer.Stop();
            _retryTimer.Interval = TimeSpan.FromSeconds(delay);
            _retryTimer.Start();
        }

        private async void RetryTimer_Tick(object sender, object e)
        {
            _retryTimer.Stop();
            if (_suspended)
                return;

            if (!_coreReady)
            {
                await InitializeWorldViewAsync();
                return;
            }

            NavigateToWorld();
        }

        private void ShowRecoveryPanel(string detail)
        {
            RecoveryDetails.Text = detail;
            RecoveryPanel.Visibility = Visibility.Visible;
            WorldView.Visibility = Visibility.Collapsed;
        }

        private void ApplySafeArea()
        {
            var bounds = Window.Current.Bounds;
            var horizontal = bounds.Width * 0.05;
            var vertical = bounds.Height * 0.05;
            WorldView.Margin = new Thickness(horizontal, vertical, horizontal, vertical);
            RecoveryPanel.Margin = new Thickness(horizontal, vertical, horizontal, vertical);
        }

        private void RootGrid_SizeChanged(object sender, SizeChangedEventArgs e)
        {
            ApplySafeArea();
        }

        private void BackRequested(object sender, BackRequestedEventArgs e)
        {
            e.Handled = true;
            PostToPage("{\"type\":\"back\"}");
        }

        private void CoreWindow_KeyDown(CoreWindow sender, KeyEventArgs args)
        {
            if (args.VirtualKey == VirtualKey.GamepadB)
            {
                args.Handled = true;
                PostToPage("{\"type\":\"back\"}");
            }
        }

        private void Application_Suspending(object sender, SuspendingEventArgs e)
        {
            var deferral = e.SuspendingOperation.GetDeferral();
            _suspended = true;
            _retryTimer.Stop();
            PostToPage("{\"type\":\"suspend\"}");
            deferral.Complete();
        }

        private void CoreApplication_Resuming(object sender, object e)
        {
            _suspended = false;
            PostToPage("{\"type\":\"resume\"}");
            if (_showingOffline)
                ScheduleRetry();
        }

        private void PostToPage(string json)
        {
            if (!_coreReady)
                return;

            try
            {
                WorldView.CoreWebView2.PostWebMessageAsJson(json);
            }
            catch (Exception)
            {
                // The process failure handler owns recovery if the page is gone.
            }
        }
    }
}
