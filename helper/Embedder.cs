using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Text;
using System.Collections.Generic;

class Embedder
{
    // Windows API Constants
    const int GWL_STYLE = -16;
    const int GWL_EXSTYLE = -20;
    const int WS_CAPTION = 0x00C00000;
    const int WS_THICKFRAME = 0x00040000;
    const int WS_POPUP = unchecked((int)0x80000000);
    const int WS_EX_TRANSPARENT = 0x00000020;
    const int SW_HIDE = 0;
    const int SW_SHOW = 5;

    // Windows API Functions
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

    [DllImport("user32.dll")]
    static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    static extern long GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    static extern bool ScreenToClient(IntPtr hWnd, ref System.Drawing.Point lpPoint);

    [DllImport("user32.dll")]
    static extern bool GetClientRect(IntPtr hWnd, out System.Drawing.Rectangle lpRect);

    // SetWindowPos flags
    const uint SWP_NOMOVE = 0x0002;
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_NOZORDER = 0x0004;
    const uint SWP_SHOWWINDOW = 0x0040;
    const uint SWP_HIDEWINDOW = 0x0080;
    static readonly IntPtr HWND_BOTTOM = new IntPtr(1);
    static readonly IntPtr HWND_TOP = new IntPtr(0);
    static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    static IntPtr FindWindowByTitle(string[] searchTerms)
    {
        // Terminal window titles to exclude
        string[] excludedTitles = { "cmd", "powershell", "command prompt", "windows terminal", "administrator", "conhost" };

        IntPtr bestMatch = IntPtr.Zero;
        int bestTitleLength = 0;

        EnumWindowsProc enumProc = (hWnd, lParam) =>
        {
            if (!IsWindowVisible(hWnd))
                return true;

            StringBuilder windowTitle = new StringBuilder(256);
            GetWindowText(hWnd, windowTitle, 256);
            string title = windowTitle.ToString();

            if (string.IsNullOrEmpty(title))
                return true;

            string titleLower = title.ToLower();

            // Skip terminal/console windows
            foreach (string excluded in excludedTitles)
            {
                if (titleLower.Contains(excluded))
                    return true; // Continue enumeration
            }

            // Skip windows with very short titles (likely console windows)
            if (title.Length < 5)
                return true;

            // Check if all search terms are present (case-insensitive partial match)
            bool allTermsFound = true;
            foreach (string term in searchTerms)
            {
                if (!titleLower.Contains(term.ToLower()))
                {
                    allTermsFound = false;
                    break;
                }
            }

            if (allTermsFound)
            {
                // Prefer windows with longer titles (likely the actual application window)
                // e.g., "Kidney Service Batch v2.1.1" is better than "Kidney"
                if (title.Length > bestTitleLength)
                {
                    bestMatch = hWnd;
                    bestTitleLength = title.Length;
                }
            }

            return true; // Continue enumeration to find the best match
        };

        EnumWindows(enumProc, IntPtr.Zero);
        return bestMatch;
    }

    static void Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.Error.WriteLine("Usage: Embedder.exe <command> [args...]");
            Console.Error.WriteLine("Commands:");
            Console.Error.WriteLine("  embed <parentHwnd> <childExePath> <searchTerms...>");
            Console.Error.WriteLine("  show <hwnd> <x> <y> <width> <height>");
            Console.Error.WriteLine("  hide <hwnd>");
            Environment.Exit(1);
            return;
        }

        string command = args[0].ToLower();

        try
        {
            if (command == "embed")
            {
                IntPtr parentHwnd = new IntPtr(Convert.ToInt64(args[1]));
                string exePath = args[2];
                string[] searchTerms = new string[args.Length - 3];
                Array.Copy(args, 3, searchTerms, 0, searchTerms.Length);

                // Start the child process
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = exePath,
                    WorkingDirectory = System.IO.Path.GetDirectoryName(exePath),
                    UseShellExecute = true
                };

                Process proc = Process.Start(startInfo);
                if (proc == null)
                {
                    Console.Error.WriteLine("ERROR: Failed to start process");
                    Environment.Exit(1);
                    return;
                }

                // Wait for window to appear (up to 30 seconds)
                // First wait a bit for the terminal/launcher to start
                Thread.Sleep(2000);
                
                IntPtr childHwnd = IntPtr.Zero;
                int attempts = 0;
                int maxAttempts = 60; // 30 seconds (60 * 500ms) - increased for slower apps

                while (attempts < maxAttempts && childHwnd == IntPtr.Zero)
                {
                    Thread.Sleep(500);
                    childHwnd = FindWindowByTitle(searchTerms);
                    attempts++;
                    
                    // Every 10 attempts, log progress
                    if (attempts % 10 == 0 && childHwnd == IntPtr.Zero)
                    {
                        Console.Error.WriteLine($"Still searching for window... (attempt {attempts}/{maxAttempts})");
                    }
                }

                if (childHwnd == IntPtr.Zero)
                {
                    Console.Error.WriteLine("ERROR: Target window not found");
                    Console.Error.WriteLine($"Searched for terms: {string.Join(", ", searchTerms)}");
                    Environment.Exit(1);
                    return;
                }

                // Log the found window title for debugging
                StringBuilder foundTitle = new StringBuilder(256);
                GetWindowText(childHwnd, foundTitle, 256);
                Console.Error.WriteLine($"Found window: \"{foundTitle}\"");

                // Set parent window
                SetParent(childHwnd, parentHwnd);

                // Modify window style to remove title bar and border
                long style = GetWindowLong(childHwnd, GWL_STYLE);
                SetWindowLong(childHwnd, GWL_STYLE, (int)((style & ~WS_CAPTION & ~WS_THICKFRAME) | WS_POPUP));

                // Hide initially and set Z-order to bottom
                ShowWindow(childHwnd, SW_HIDE);
                
                // Ensure window is behind parent (this helps with menu interactions)
                SetWindowPos(childHwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_HIDEWINDOW);

                // Output HWND for further operations
                Console.WriteLine($"SUCCESS:{childHwnd.ToInt64()}");

            }
            else if (command == "show")
            {
                if (args.Length < 6)
                {
                    Console.Error.WriteLine("ERROR: Show command requires hwnd, x, y, width, height");
                    Environment.Exit(1);
                    return;
                }

                IntPtr childHwnd = new IntPtr(Convert.ToInt64(args[1]));
                int screenX = Convert.ToInt32(args[2]);
                int screenY = Convert.ToInt32(args[3]);
                int width = Convert.ToInt32(args[4]);
                int height = Convert.ToInt32(args[5]);

                // Get parent window handle (child window's parent)
                IntPtr parentHwnd = new IntPtr(GetWindowLong(childHwnd, -8)); // GWL_HWNDPARENT = -8

                // Remove WS_EX_TRANSPARENT if it was set (so window can receive input)
                long exStyle = GetWindowLong(childHwnd, GWL_EXSTYLE);
                if ((exStyle & WS_EX_TRANSPARENT) != 0)
                {
                    SetWindowLong(childHwnd, GWL_EXSTYLE, (int)(exStyle & ~WS_EX_TRANSPARENT));
                }

                // Convert screen coordinates to parent window client coordinates
                System.Drawing.Point pt = new System.Drawing.Point(screenX, screenY);
                if (parentHwnd != IntPtr.Zero)
                {
                    ScreenToClient(parentHwnd, ref pt);
                }

                // Move and resize with parent client coordinates
                MoveWindow(childHwnd, pt.X, pt.Y, width, height, true);
                
                // Then show and bring to top (but still child of parent)
                SetWindowPos(childHwnd, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                
                // Ensure it's visible
                ShowWindow(childHwnd, SW_SHOW);
                
                Console.WriteLine("SUCCESS");
            }
            else if (command == "hide")
            {
                if (args.Length < 2)
                {
                    Console.Error.WriteLine("ERROR: Hide command requires hwnd");
                    Environment.Exit(1);
                    return;
                }

                IntPtr hwnd = new IntPtr(Convert.ToInt64(args[1]));
                ShowWindow(hwnd, SW_HIDE);
                
                // Also move to bottom of Z-order to ensure it doesn't block menu
                SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_HIDEWINDOW | SWP_NOZORDER);
                
                Console.WriteLine("SUCCESS");
            }
            else if (command == "disableinput")
            {
                // Temporarily disable input to allow clicks to pass through to parent
                IntPtr hwnd = new IntPtr(Convert.ToInt64(args[1]));
                long exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
                SetWindowLong(hwnd, GWL_EXSTYLE, (int)(exStyle | WS_EX_TRANSPARENT));
                Console.WriteLine("SUCCESS");
            }
            else if (command == "enableinput")
            {
                // Re-enable input
                IntPtr hwnd = new IntPtr(Convert.ToInt64(args[1]));
                long exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
                SetWindowLong(hwnd, GWL_EXSTYLE, (int)(exStyle & ~WS_EX_TRANSPARENT));
                Console.WriteLine("SUCCESS");
            }
            else
            {
                Console.Error.WriteLine("ERROR: Unknown command");
                Environment.Exit(1);
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"ERROR: {ex.Message}");
            Environment.Exit(1);
        }
    }
}

