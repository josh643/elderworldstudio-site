using System;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Windows.Data.Json;
using Windows.Storage;
using Windows.UI.Core;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Windows.UI.Xaml.Navigation;
using WV2 = Microsoft.UI.Xaml.Controls.WebView2;

namespace ElderverseShell
{
    public sealed partial class MainPage : Page
    {
        // Game shell, not a browser: one allowlisted origin, no address bar, no new windows.
        private string _startUrl = "https://office-3d.elderworldstudio.pages.dev/office/?platform=xbox";
        private Uri _origin;
        private int _retry;
        private bool _reloadedAfterCrash;
        private static readonly int[] Backoff = { 5, 10, 30, 60 };
        private bool _offline;
        private string _offlineHtml = "<html><body style=\"background:#0b1320;color:#e8e2d0;font:32px Segoe UI;text-align:center;padding-top:20%\">Elderverse<br>Reconnecting...</body></html>";

        private WV2 Web;
        private WebView Classic;

        public void ShowStatus(string t) { var _ = Dispatcher.RunAsync(CoreDispatcherPriority.Normal, () => { Status.Text = t; Status.Visibility = Visibility.Visible; }); }

        public MainPage()
        {
            InitializeComponent();
            Loaded += OnLoaded;
            SystemNavigationManager.GetForCurrentView().BackRequested += OnBack;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            try
            {
                var f = await StorageFile.GetFileFromApplicationUriAsync(new Uri("ms-appx:///shell.config.json"));
                var j = JsonObject.Parse(await FileIO.ReadTextAsync(f));
                _startUrl = j.GetNamedString("startUrl", _startUrl);
            }
            catch { }
            try
            {
                var o = await StorageFile.GetFileFromApplicationUriAsync(new Uri("ms-appx:///Offline/offline.html"));
                _offlineHtml = await FileIO.ReadTextAsync(o);
            }
            catch { }
            _origin = new Uri(_startUrl);
            var ls = ApplicationData.Current.LocalSettings.Values;
            bool wv2Crashed = ls.ContainsKey("wv2_attempt");   // previous launch died inside WebView2 init -> use classic WebView
            try
            {
                if (wv2Crashed) throw new InvalidOperationException("previous WebView2 start crashed");
                ls["wv2_attempt"] = 1;
                Web = new WV2();
                Root.Children.Insert(0, Web);
                await Web.EnsureCoreWebView2Async();
                var core = Web.CoreWebView2;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.NewWindowRequested += (s2, a) => { a.Handled = true; };
                core.NavigationStarting += OnNavigationStarting;
                core.NavigationCompleted += OnNavigationCompleted;
                core.ProcessFailed += OnProcessFailed;
                Status.Visibility = Visibility.Collapsed;
                core.Navigate(_startUrl);
                ls.Remove("wv2_attempt");
                return;
            }
            catch (Exception ex)
            {
                try { if (Web != null) Root.Children.Remove(Web); } catch { }
                Web = null;
                ShowStatus("WebView2 unavailable (" + ex.GetType().Name + ": " + ex.Message + "), using classic WebView");
            }
            try
            {
                Classic = new WebView(WebViewExecutionMode.SeparateThread);
                Classic.NavigationStarting += (s3, a) => { if (a.Uri != null && !Allowed(a.Uri)) a.Cancel = true; };
                Classic.NewWindowRequested += (s3, a) => { a.Handled = true; };
                Classic.NavigationCompleted += (s3, a) => { if (a.IsSuccess) Status.Visibility = Visibility.Collapsed; else ShowStatus("Reconnecting... (" + a.WebErrorStatus + ")"); };
                Root.Children.Insert(0, Classic);
                Classic.Navigate(new Uri(_startUrl));
            }
            catch (Exception ex2) { ShowStatus("Shell error: " + ex2); }
        }

        private bool Allowed(Uri u)
        {
            if (u == null) return false;
            if (_offline && (u.Scheme == "data" || u.Scheme == "about")) return true;
            return u.Scheme == "https" && string.Equals(u.Host, _origin.Host, StringComparison.OrdinalIgnoreCase);
        }

        private void OnNavigationStarting(CoreWebView2 s, CoreWebView2NavigationStartingEventArgs a)
        {
            Uri u;
            if (!Uri.TryCreate(a.Uri, UriKind.Absolute, out u) || !Allowed(u)) a.Cancel = true;
        }

        private async void OnNavigationCompleted(CoreWebView2 s, CoreWebView2NavigationCompletedEventArgs a)
        {
            if (_offline) return;
            if (a.IsSuccess) { _retry = 0; return; }
            await ShowOfflineThenRetry();
        }

        private async Task ShowOfflineThenRetry()
        {
            int wait = Backoff[Math.Min(_retry, Backoff.Length - 1)];
            _retry++;
            _offline = true;
            try { Web.CoreWebView2.NavigateToString(_offlineHtml); } catch { }
            await Task.Delay(TimeSpan.FromSeconds(wait));
            _offline = false;
            try { Web.CoreWebView2.Navigate(_startUrl); } catch { }
        }

        private void OnProcessFailed(CoreWebView2 s, CoreWebView2ProcessFailedEventArgs a)
        {
            var _ = Dispatcher.RunAsync(CoreDispatcherPriority.Normal, () =>
            {
                if (!_reloadedAfterCrash) { _reloadedAfterCrash = true; try { Web?.CoreWebView2?.Reload(); } catch { } }
                else { var t = ShowOfflineThenRetry(); }
            });
        }

        private void OnBack(object sender, BackRequestedEventArgs e)
        {
            // Gamepad B: hand to the page; never exit mid-session without the page's confirm.
            e.Handled = true;
            try { Web?.CoreWebView2?.PostWebMessageAsJson("{\"type\":\"back\"}"); } catch { }
        }

        public void PostLifecycle(string type)
        {
            try { Web?.CoreWebView2?.PostWebMessageAsJson("{\"type\":\"" + type + "\"}"); } catch { }
        }
    }
}
