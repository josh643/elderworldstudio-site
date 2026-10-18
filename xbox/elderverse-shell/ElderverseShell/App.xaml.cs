using System;
using Windows.ApplicationModel;
using Windows.ApplicationModel.Activation;
using Windows.UI.Xaml;

namespace ElderverseShell
{
    sealed partial class App : Application
    {
        public App()
        {
            InitializeComponent();
#if DEBUG
            // WebView2 reads this before its first environment is created.
            try
            {
                Environment.SetEnvironmentVariable(
                    "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                    "--remote-debugging-port=9222");
            }
            catch
            {
                // Debugging is optional; the app must still start in restricted containers.
            }
#endif
        }

        protected override void OnLaunched(LaunchActivatedEventArgs e)
        {
            var frame = Window.Current.Content as Windows.UI.Xaml.Controls.Frame;
            if (frame == null)
            {
                frame = new Windows.UI.Xaml.Controls.Frame();
                Window.Current.Content = frame;
            }

            if (frame.Content == null)
                frame.Navigate(typeof(MainPage), e.Arguments);

            Window.Current.Activate();
        }
    }
}
