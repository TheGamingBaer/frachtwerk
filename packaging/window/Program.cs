// Frachtwerk – eigenes App-Fenster (WebView2 statt Browser).
// Wird von Frachtwerk.exe gestartet:  FrachtwerkFenster.exe --url <adresse> --data <ordner>
// Weitere Adressen kommen zeilenweise über stdin (Fenster nach vorne holen + navigieren).
// Exit-Code 3 = WebView2-Laufzeit fehlt (Frachtwerk.exe fällt dann auf den Browser zurück).
using System;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Frachtwerk
{
    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            string url = null, data = null;
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == "--url") url = args[i + 1];
                if (args[i] == "--data") data = args[i + 1];
            }
            string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Frachtwerk");
            if (data == null) data = Path.Combine(appData, "Fenster");
            Directory.CreateDirectory(data);

            // Ohne Adresse (z. B. über ein angeheftetes Taskleisten-Symbol gestartet): Frachtwerk bitten, das Fenster zu öffnen
            if (url == null) return Relaunch(appData);

            try { CoreWebView2Environment.GetAvailableBrowserVersionString(); }
            catch (WebView2RuntimeNotFoundException) { return 3; }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm(url, data));
            return 0;
        }

        static int Relaunch(string appData)
        {
            try { using (var c = new WebClient()) c.UploadString("http://127.0.0.1:47842/show", "POST", ""); return 0; }
            catch
            {
                string exe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Frachtwerk", "Frachtwerk.exe");
                if (File.Exists(exe)) System.Diagnostics.Process.Start(exe);
                return 0;
            }
        }
    }

    class MainForm : Form
    {
        readonly WebView2 web = new WebView2();
        readonly string stateFile;
        readonly string startUrl;
        static readonly Color Bg = Color.FromArgb(5, 6, 10);

        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

        public MainForm(string url, string dataDir)
        {
            startUrl = url;
            stateFile = Path.Combine(dataDir, "fenster.txt");
            Text = "Frachtwerk";
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            BackColor = Bg;
            MinimumSize = new Size(900, 600);
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(1400, 900);
            LoadBounds();

            web.Dock = DockStyle.Fill;
            web.DefaultBackgroundColor = Bg;   // kein weißes Aufblitzen beim Laden
            web.CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = Path.Combine(dataDir, "WebView2") };
            Controls.Add(web);

            Load += async (s, e) => await InitAsync();
            FormClosing += (s, e) => SaveBounds();
            HandleCreated += (s, e) => { int on = 1; try { DwmSetWindowAttribute(Handle, 20, ref on, 4); } catch { } }; // dunkle Titelleiste
            StartStdinReader();
        }

        async Task InitAsync()
        {
            try
            {
                await web.EnsureCoreWebView2Async();
                var s = web.CoreWebView2.Settings;
                s.IsStatusBarEnabled = false;
                s.AreDevToolsEnabled = false;
                s.IsZoomControlEnabled = true;
                s.AreBrowserAcceleratorKeysEnabled = true;
                web.CoreWebView2.DocumentTitleChanged += (o, a) => Text = string.IsNullOrWhiteSpace(web.CoreWebView2.DocumentTitle) ? "Frachtwerk" : web.CoreWebView2.DocumentTitle;
                // Links in neuen Fenstern (Discord, GitHub …) im normalen Browser öffnen
                web.CoreWebView2.NewWindowRequested += (o, a) => { a.Handled = true; OpenExternal(a.Uri); };
                web.CoreWebView2.Navigate(startUrl);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Das Frachtwerk-Fenster konnte nicht starten:\n" + ex.Message, "Frachtwerk", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Environment.Exit(4);
            }
        }

        static void OpenExternal(string uri)
        {
            if (uri != null && (uri.StartsWith("https://") || uri.StartsWith("http://")))
                try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(uri) { UseShellExecute = true }); } catch { }
        }

        // Frachtwerk.exe schickt weitere Adressen über stdin
        void StartStdinReader()
        {
            var t = new Thread(() =>
            {
                try
                {
                    string line;
                    while ((line = Console.In.ReadLine()) != null)
                    {
                        string next = line.Trim();
                        if (next.Length == 0) continue;
                        BeginInvoke(new Action(() => ShowAndNavigate(next)));
                    }
                }
                catch { }
            }) { IsBackground = true };
            t.Start();
        }

        void ShowAndNavigate(string next)
        {
            if (next == "quit") { Close(); return; }
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Show(); TopMost = true; Activate(); TopMost = false;
            if (next != "show" && web.CoreWebView2 != null) web.CoreWebView2.Navigate(next);
        }

        void LoadBounds()
        {
            try
            {
                var p = File.ReadAllText(stateFile).Split(',');
                var r = new Rectangle(int.Parse(p[0]), int.Parse(p[1]), int.Parse(p[2]), int.Parse(p[3]));
                if (Screen.FromRectangle(r).WorkingArea.IntersectsWith(r) && r.Width >= 900 && r.Height >= 600) { StartPosition = FormStartPosition.Manual; Bounds = r; }
                if (p.Length > 4 && p[4] == "max") WindowState = FormWindowState.Maximized;
            }
            catch { }
        }

        void SaveBounds()
        {
            try
            {
                var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                File.WriteAllText(stateFile, $"{r.X},{r.Y},{r.Width},{r.Height},{(WindowState == FormWindowState.Maximized ? "max" : "normal")}");
            }
            catch { }
        }
    }
}
