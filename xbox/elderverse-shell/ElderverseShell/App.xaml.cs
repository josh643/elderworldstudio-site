using System;
using Windows.ApplicationModel;
using Windows.ApplicationModel.Activation;
using Windows.UI.ViewManagement;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace ElderverseShell
{
    sealed partial class App : Application
    {
        public App()
        {
            InitializeComponent();
            Suspending += OnSuspending;
            Resuming += OnResuming;
        }

        protected override void OnLaunched(LaunchActivatedEventArgs e)
        {
            // We draw our own TV safe area in the web client (?platform=xbox).
            try { ApplicationView.GetForCurrentView().SetDesiredBoundsMode(ApplicationViewBoundsMode.UseCoreWindow); } catch { }
            var frame = Window.Current.Content as Frame;
            if (frame == null)
            {
                frame = new Frame();
                Window.Current.Content = frame;
            }
            if (frame.Content == null) frame.Navigate(typeof(MainPage), e.Arguments);
            Window.Current.Activate();
        }

        private void OnSuspending(object sender, SuspendingEventArgs e)
        {
            var d = e.SuspendingOperation.GetDeferral();
            (( Window.Current.Content as Frame)?.Content as MainPage)?.PostLifecycle("suspend");
            d.Complete();
        }

        private void OnResuming(object sender, object e)
        {
            ((Window.Current.Content as Frame)?.Content as MainPage)?.PostLifecycle("resume");
        }
    }
}
