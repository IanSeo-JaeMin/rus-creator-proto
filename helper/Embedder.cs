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
    const int GWL_HWNDPARENT = -8;
    const int WS_CAPTION = 0x00C00000;
    const int WS_THICKFRAME = 0x00040000;
    const int WS_POPUP = unchecked((int)0x80000000);
    const int WS_CHILD = 0x40000000; // Child window style
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
    static extern bool ClientToScreen(IntPtr hWnd, ref System.Drawing.Point lpPoint);

    [DllImport("user32.dll")]
    static extern bool GetClientRect(IntPtr hWnd, out System.Drawing.Rectangle lpRect);

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out System.Drawing.Rectangle lpRect);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

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
        
        // Console window class names to exclude
        string[] excludedClasses = { "ConsoleWindowClass", "VirtualConsoleClass" };

        IntPtr bestMatch = IntPtr.Zero;
        int bestTitleLength = 0;
        int bestWindowSize = 0; // Prefer larger windows (likely the actual app window)

        EnumWindowsProc enumProc = (hWnd, lParam) =>
        {
            if (!IsWindowVisible(hWnd))
                return true;

            // Check window class name first to exclude console windows
            StringBuilder className = new StringBuilder(256);
            GetClassName(hWnd, className, 256);
            string classStr = className.ToString();
            string classLower = classStr.ToLower();

            foreach (string excludedClass in excludedClasses)
            {
                if (classLower.Contains(excludedClass.ToLower()))
                {
                    return true; // Skip console windows
                }
            }

            StringBuilder windowTitle = new StringBuilder(256);
            GetWindowText(hWnd, windowTitle, 256);
            string title = windowTitle.ToString();

            if (string.IsNullOrEmpty(title))
                return true;

            string titleLower = title.ToLower();

            // Skip terminal/console windows by title
            foreach (string excluded in excludedTitles)
            {
                if (titleLower.Contains(excluded))
                    return true; // Continue enumeration
            }

            // Skip windows with very short titles (likely console windows)
            // But allow some flexibility for apps with short names
            if (title.Length < 3)
                return true;

            // Get window size to prefer larger windows (actual app windows are usually larger)
            System.Drawing.Rectangle rect;
            bool gotRect = GetClientRect(hWnd, out rect);
            int windowSize = gotRect ? (rect.Width * rect.Height) : 0;

            // Skip very small windows (likely console or popup windows)
            // Most application windows are at least 400x300 pixels
            if (windowSize > 0 && windowSize < 120000) // 400 * 300
            {
                // Only skip small windows if they look like console windows
                // (very small width or height suggests console)
                if (rect.Width < 200 || rect.Height < 150)
                {
                    return true;
                }
            }

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
                // Prefer windows that are:
                // 1. Larger (actual app windows are usually bigger)
                // 2. Have longer titles (more descriptive)
                // 3. Not console windows (already excluded above)
                
                bool isBetterMatch = false;
                if (windowSize > bestWindowSize)
                {
                    isBetterMatch = true;
                }
                else if (windowSize == bestWindowSize && title.Length > bestTitleLength)
                {
                    isBetterMatch = true;
                }
                else if (bestWindowSize == 0 && title.Length > bestTitleLength)
                {
                    // Fallback: if we can't determine size, use title length
                    isBetterMatch = true;
                }

                if (isBetterMatch)
                {
                    bestMatch = hWnd;
                    bestTitleLength = title.Length;
                    bestWindowSize = windowSize;
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

                // Get process ID before waiting (UseShellExecute = true may cause issues with proc.Id)
                int processId = 0;
                try
                {
                    // Wait a moment for process to initialize
                    Thread.Sleep(100);
                    if (!proc.HasExited)
                    {
                        processId = proc.Id;
                    }
                    else
                    {
                        // Process exited quickly, try to find it by window title later
                        Console.Error.WriteLine("WARNING: Process exited quickly, PID may be unavailable");
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"WARNING: Could not get process ID: {ex.Message}");
                }

                // Wait for window to appear (up to 45 seconds)
                // First wait a bit for the terminal/launcher to start
                // For apps like Blender that launch via command prompt, we need extra time
                Thread.Sleep(3000);
                
                IntPtr childHwnd = IntPtr.Zero;
                int attempts = 0;
                int maxAttempts = 90; // 45 seconds (90 * 500ms) - increased for apps with delayed window creation

                while (attempts < maxAttempts && childHwnd == IntPtr.Zero)
                {
                    Thread.Sleep(500);
                    childHwnd = FindWindowByTitle(searchTerms);
                    attempts++;
                    
                    // Log all windows found (for debugging)
                    if (attempts % 5 == 0 && childHwnd == IntPtr.Zero)
                    {
                        Console.Error.WriteLine($"Still searching for window... (attempt {attempts}/{maxAttempts})");
                        Console.Error.WriteLine($"Search terms: {string.Join(", ", searchTerms)}");
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
                
                // Get window class name for debugging
                StringBuilder foundClass = new StringBuilder(256);
                GetClassName(childHwnd, foundClass, 256);
                
                // Get window size for debugging
                System.Drawing.Rectangle foundRect;
                bool gotFoundRect = GetClientRect(childHwnd, out foundRect);
                string sizeInfo = gotFoundRect ? $"{foundRect.Width}x{foundRect.Height}" : "unknown";
                
                Console.Error.WriteLine($"Found window: \"{foundTitle}\"");
                Console.Error.WriteLine($"  Class: {foundClass}");
                Console.Error.WriteLine($"  Size: {sizeInfo}");
                
                // Check if window is currently visible
                bool wasVisible = IsWindowVisible(childHwnd);
                Console.Error.WriteLine($"Window visibility before embed: {wasVisible}");

                // Set parent window
                IntPtr previousParent = SetParent(childHwnd, parentHwnd);
                Console.Error.WriteLine($"SetParent result: Previous parent was {previousParent.ToInt64()}, New parent is {parentHwnd.ToInt64()}");

                // Get window rectangle before style change
                System.Drawing.Rectangle rect;
                bool gotRect = GetClientRect(childHwnd, out rect);
                if (gotRect)
                {
                    Console.Error.WriteLine($"Window client rect before style change: {rect.Width}x{rect.Height}");
                }

                // Modify window style to remove title bar and border
                // IMPORTANT: For SetParent to work reliably, we may need WS_CHILD style
                // However, WS_POPUP and WS_CHILD are mutually exclusive
                // Qt windows typically work better with WS_POPUP
                long style = GetWindowLong(childHwnd, GWL_STYLE);
                long newStyle = (style & ~WS_CAPTION & ~WS_THICKFRAME) | WS_POPUP;
                int styleResult = SetWindowLong(childHwnd, GWL_STYLE, (int)newStyle);
                Console.Error.WriteLine($"Style change: Old=0x{style:X8}, New=0x{newStyle:X8}, Result={styleResult}");
                
                // Also set GWL_HWNDPARENT explicitly to ensure parent relationship
                SetWindowLong(childHwnd, GWL_HWNDPARENT, parentHwnd.ToInt32());
                Console.Error.WriteLine($"Set GWL_HWNDPARENT explicitly to {parentHwnd.ToInt64()}");

                // Hide initially and set Z-order to bottom
                ShowWindow(childHwnd, SW_HIDE);
                
                // Ensure window is behind parent (this helps with menu interactions)
                SetWindowPos(childHwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_HIDEWINDOW);
                
                // Verify window is hidden
                bool isNowVisible = IsWindowVisible(childHwnd);
                Console.Error.WriteLine($"Window visibility after embed (should be hidden): {isNowVisible}");

                // Output HWND and PID for further operations
                // Format: SUCCESS:HWND:PID
                // If PID is 0 or unavailable, output 0
                int finalPid = processId;
                if (finalPid == 0)
                {
                    try
                    {
                        // Try to get PID from window handle
                        // Note: This is a fallback, may not always work
                        uint processIdFromHwnd = 0;
                        uint threadId = GetWindowThreadProcessId(childHwnd, out processIdFromHwnd);
                        if (processIdFromHwnd != 0)
                        {
                            finalPid = (int)processIdFromHwnd;
                        }
                    }
                    catch
                    {
                        // Ignore errors
                    }
                }
                
                // IMPORTANT: SUCCESS must be the last line and must go to stdout
                // All debug messages should go to stderr and be printed before this
                Console.Out.Flush();
                Console.Error.Flush();
                Console.WriteLine($"SUCCESS:{childHwnd.ToInt64()}:{finalPid}");
                Console.Out.Flush();

            }
            else if (command == "show")
            {
                if (args.Length < 7)
                {
                    Console.Error.WriteLine("ERROR: Show command requires hwnd, parentHwnd, x, y, width, height");
                    Environment.Exit(1);
                    return;
                }

                IntPtr childHwnd = new IntPtr(Convert.ToInt64(args[1]));
                IntPtr parentHwnd = new IntPtr(Convert.ToInt64(args[2]));
                int screenX = Convert.ToInt32(args[3]);
                int screenY = Convert.ToInt32(args[4]);
                int width = Convert.ToInt32(args[5]);
                int height = Convert.ToInt32(args[6]);

                // Verify parent relationship - if parent is 0 or GetWindowLong returns different value, re-set parent
                IntPtr currentParent = new IntPtr(GetWindowLong(childHwnd, -8)); // GWL_HWNDPARENT = -8
                
                // Log window state for debugging
                bool wasVisible = IsWindowVisible(childHwnd);
                Console.Error.WriteLine($"Window state before show: Visible={wasVisible}, Current Parent={currentParent.ToInt64()}, Expected Parent={parentHwnd.ToInt64()}");
                
                // If parent doesn't match or is 0, re-set parent
                if (currentParent != parentHwnd && parentHwnd != IntPtr.Zero)
                {
                    Console.Error.WriteLine($"Re-setting parent window from {currentParent.ToInt64()} to {parentHwnd.ToInt64()}");
                    
                    // Method 1: Use SetParent
                    IntPtr previousParent = SetParent(childHwnd, parentHwnd);
                    Console.Error.WriteLine($"SetParent result: Previous parent was {previousParent.ToInt64()}, New parent is {parentHwnd.ToInt64()}");
                    
                    // Method 2: Also set GWL_HWNDPARENT directly (may be more reliable for Qt windows)
                    SetWindowLong(childHwnd, GWL_HWNDPARENT, parentHwnd.ToInt32());
                    Console.Error.WriteLine($"Set GWL_HWNDPARENT directly to {parentHwnd.ToInt64()}");
                    
                    // Verify parent was set
                    IntPtr verifyParent = new IntPtr(GetWindowLong(childHwnd, GWL_HWNDPARENT));
                    Console.Error.WriteLine($"Verified parent after setting: {verifyParent.ToInt64()}");
                    
                    // After SetParent, ensure window style is still correct for child window
                    // Some applications (like Qt) may change window style after SetParent
                    long styleAfter = GetWindowLong(childHwnd, GWL_STYLE);
                    long newStyleAfter = (styleAfter & ~WS_CAPTION & ~WS_THICKFRAME) | WS_POPUP;
                    if (styleAfter != newStyleAfter)
                    {
                        SetWindowLong(childHwnd, GWL_STYLE, (int)newStyleAfter);
                        Console.Error.WriteLine($"Re-applied window style after SetParent: 0x{styleAfter:X8} -> 0x{newStyleAfter:X8}");
                    }
                    
                    // Small delay for Qt windows to adjust after SetParent
                    Thread.Sleep(100);
                    
                    // Final verification - check parent one more time
                    IntPtr finalParent = new IntPtr(GetWindowLong(childHwnd, GWL_HWNDPARENT));
                    if (finalParent != parentHwnd)
                    {
                        Console.Error.WriteLine($"WARNING: Parent was reset to {finalParent.ToInt64()} after SetParent! Qt window may be interfering.");
                        // Qt windows may completely ignore SetParent - this is a known limitation
                        // We'll need to use alternative positioning approach if parent keeps resetting
                        if (finalParent == IntPtr.Zero)
                        {
                            Console.Error.WriteLine($"CRITICAL: Qt window completely ignores parent relationship. This may require alternative embedding approach.");
                        }
                        // Try one more time with longer delay
                        Thread.Sleep(150);
                        SetParent(childHwnd, parentHwnd);
                        SetWindowLong(childHwnd, GWL_HWNDPARENT, parentHwnd.ToInt32());
                        Thread.Sleep(50);
                    }
                }

                // Remove WS_EX_TRANSPARENT if it was set (so window can receive input)
                long exStyle = GetWindowLong(childHwnd, GWL_EXSTYLE);
                if ((exStyle & WS_EX_TRANSPARENT) != 0)
                {
                    SetWindowLong(childHwnd, GWL_EXSTYLE, (int)(exStyle & ~WS_EX_TRANSPARENT));
                    Console.Error.WriteLine("Removed WS_EX_TRANSPARENT flag");
                }

                // Convert screen coordinates to parent window client coordinates
                System.Drawing.Point pt = new System.Drawing.Point(screenX, screenY);
                int clientX = screenX;
                int clientY = screenY;
                
                // First verify parent exists and is valid
                if (parentHwnd != IntPtr.Zero)
                {
                    // Verify parent window is still valid
                    uint parentThreadId = 0;
                    GetWindowThreadProcessId(parentHwnd, out parentThreadId);
                    if (parentThreadId == 0)
                    {
                        Console.Error.WriteLine($"WARNING: Parent window {parentHwnd.ToInt64()} is invalid!");
                    }
                    else
                    {
                        bool converted = ScreenToClient(parentHwnd, ref pt);
                        if (converted)
                        {
                            clientX = pt.X;
                            clientY = pt.Y;
                            Console.Error.WriteLine($"Converted coordinates: Screen({screenX}, {screenY}) -> Client({clientX}, {clientY})");
                        }
                        else
                        {
                            Console.Error.WriteLine($"WARNING: Failed to convert screen coordinates to client coordinates, using screen coordinates");
                            // If conversion fails, parent may be invalid or window may have moved
                            // In this case, Qt windows may need to use screen coordinates anyway
                        }
                    }
                }
                else
                {
                    Console.Error.WriteLine("WARNING: No parent window found, using screen coordinates");
                }
                
                // For Qt windows that reset parent to 0, we need to work around it
                // Store original screen coordinates as fallback
                int originalScreenX = screenX;
                int originalScreenY = screenY;

                // Move and resize with parent client coordinates
                // Note: For Qt windows, we may need to force a repaint after moving
                bool moveResult = MoveWindow(childHwnd, clientX, clientY, width, height, true);
                Console.Error.WriteLine($"MoveWindow result: {moveResult}, Position: ({clientX}, {clientY}), Size: {width}x{height}");
                
                // Get window rectangle after move to verify
                System.Drawing.Rectangle movedRect;
                bool gotMovedRect = GetClientRect(childHwnd, out movedRect);
                if (gotMovedRect)
                {
                    Console.Error.WriteLine($"Window client rect after move: {movedRect.Width}x{movedRect.Height} at ({movedRect.X}, {movedRect.Y})");
                }
                
                // For child windows, we need to use HWND_TOP but within parent
                // First, ensure window is shown and then bring to top
                // Force window to be shown with SW_SHOW
                ShowWindow(childHwnd, SW_SHOW);
                
                // Small delay to allow window to process show command
                Thread.Sleep(50);
                
                // For SetParent child windows, use HWND_TOP to bring to front within parent
                // Use SWP_SHOWWINDOW to ensure it's visible
                // IMPORTANT: Set position and size again in SetWindowPos for Qt windows
                // Qt windows may reset position/size after MoveWindow
                bool setPosResult = SetWindowPos(childHwnd, HWND_TOP, clientX, clientY, width, height, SWP_SHOWWINDOW);
                Console.Error.WriteLine($"SetWindowPos result: {setPosResult}, Position: ({clientX}, {clientY}), Size: {width}x{height}");
                
                // Verify position after SetWindowPos
                System.Drawing.Rectangle rectAfterSetPos;
                bool gotRectAfterSetPos = GetClientRect(childHwnd, out rectAfterSetPos);
                if (gotRectAfterSetPos)
                {
                    Console.Error.WriteLine($"Window client rect after SetWindowPos: {rectAfterSetPos.Width}x{rectAfterSetPos.Height} at ({rectAfterSetPos.X}, {rectAfterSetPos.Y})");
                }
                
                // Force another repaint and show - try multiple times for Qt windows
                Thread.Sleep(100);
                ShowWindow(childHwnd, SW_SHOW);
                
                // CRITICAL: Check and fix parent relationship again before final display
                // Qt windows may reset parent relationship after MoveWindow/SetWindowPos
                IntPtr parentAfterMove = new IntPtr(GetWindowLong(childHwnd, GWL_HWNDPARENT));
                if (parentAfterMove != parentHwnd && parentHwnd != IntPtr.Zero)
                {
                    Console.Error.WriteLine($"WARNING: Parent was reset to {parentAfterMove.ToInt64()} after MoveWindow! Re-setting...");
                    SetParent(childHwnd, parentHwnd);
                    SetWindowLong(childHwnd, GWL_HWNDPARENT, parentHwnd.ToInt32());
                    Thread.Sleep(50);
                }
                
                // Try to bring window to front within parent using different approaches
                // First try: SetWindowPos with HWND_TOP
                SetWindowPos(childHwnd, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                
                // Verify parent again after SetWindowPos
                Thread.Sleep(50);
                IntPtr parentAfterSetPos = new IntPtr(GetWindowLong(childHwnd, GWL_HWNDPARENT));
                if (parentAfterSetPos != parentHwnd && parentHwnd != IntPtr.Zero)
                {
                    Console.Error.WriteLine($"WARNING: Parent was reset to {parentAfterSetPos.ToInt64()} after SetWindowPos! Re-setting...");
                    SetParent(childHwnd, parentHwnd);
                    SetWindowLong(childHwnd, GWL_HWNDPARENT, parentHwnd.ToInt32());
                    // Re-move window to ensure coordinates are correct
                    MoveWindow(childHwnd, clientX, clientY, width, height, true);
                    Thread.Sleep(50);
                }
                
                // Second try: Force redraw by moving slightly and back
                Thread.Sleep(50);
                MoveWindow(childHwnd, clientX + 1, clientY, width, height, true);
                Thread.Sleep(50);
                MoveWindow(childHwnd, clientX, clientY, width, height, true);
                
                // Final parent check before showing
                IntPtr finalParentCheck = new IntPtr(GetWindowLong(childHwnd, GWL_HWNDPARENT));
                if (finalParentCheck != parentHwnd && parentHwnd != IntPtr.Zero)
                {
                    Console.Error.WriteLine($"WARNING: Parent was reset to {finalParentCheck.ToInt64()} after MoveWindow! Final re-set...");
                    SetParent(childHwnd, parentHwnd);
                    SetWindowLong(childHwnd, GWL_HWNDPARENT, parentHwnd.ToInt32());
                    MoveWindow(childHwnd, clientX, clientY, width, height, true);
                    Thread.Sleep(50);
                    
                    // If parent still resets, Qt window may need screen coordinates instead
                    IntPtr parentAfterFinalSet = new IntPtr(GetWindowLong(childHwnd, GWL_HWNDPARENT));
                    if (parentAfterFinalSet == IntPtr.Zero && parentHwnd != IntPtr.Zero)
                    {
                        Console.Error.WriteLine($"CRITICAL: Qt window resets parent to 0. Attempting workaround with screen coordinates...");
                        // Try moving with screen coordinates as Qt may be using them internally
                        // But first try SetParent one more time with delay
                        Thread.Sleep(100);
                        SetParent(childHwnd, parentHwnd);
                        SetWindowLong(childHwnd, GWL_HWNDPARENT, parentHwnd.ToInt32());
                    }
                }
                
                // Third try: Show again after movement
                Thread.Sleep(50);
                ShowWindow(childHwnd, SW_SHOW);
                
                // Last attempt: If parent is still 0, Qt window completely ignores SetParent
                // In this case, we MUST use screen coordinates because parent-client coordinate
                // conversion won't work when parent is 0
                IntPtr finalParentVerify = new IntPtr(GetWindowLong(childHwnd, GWL_HWNDPARENT));
                if (finalParentVerify == IntPtr.Zero && parentHwnd != IntPtr.Zero)
                {
                    Console.Error.WriteLine($"FINAL ATTEMPT: Parent is 0, Qt window ignores SetParent. Using screen coordinates...");
                    
                    // Convert parent client coordinates back to screen coordinates
                    // We need to get parent window's position on screen
                    System.Drawing.Rectangle parentWindowRect;
                    if (GetWindowRect(parentHwnd, out parentWindowRect))
                    {
                        // Get parent's client area top-left in screen coordinates
                        System.Drawing.Point parentClientTopLeft = new System.Drawing.Point(0, 0);
                        ClientToScreen(parentHwnd, ref parentClientTopLeft);
                        
                        // Calculate screen position: parent client top-left + client offset
                        int screenPosX = parentClientTopLeft.X + clientX;
                        int screenPosY = parentClientTopLeft.Y + clientY;
                        
                        Console.Error.WriteLine($"Parent window screen position: ({parentWindowRect.Left}, {parentWindowRect.Top})");
                        Console.Error.WriteLine($"Parent client top-left (screen): ({parentClientTopLeft.X}, {parentClientTopLeft.Y})");
                        Console.Error.WriteLine($"Calculated screen position: ({screenPosX}, {screenPosY}) from client ({clientX}, {clientY})");
                        
                        // Use screen coordinates for Qt windows that ignore parent
                        SetWindowPos(childHwnd, HWND_TOP, screenPosX, screenPosY, width, height, SWP_SHOWWINDOW);
                        Console.Error.WriteLine($"SetWindowPos with calculated screen coordinates: ({screenPosX}, {screenPosY})");
                    }
                    else
                    {
                        // Fallback to original screen coordinates if we can't get parent rect
                        Console.Error.WriteLine($"WARNING: Could not get parent window rect, using original screen coordinates");
                        SetWindowPos(childHwnd, HWND_TOP, originalScreenX, originalScreenY, width, height, SWP_SHOWWINDOW);
                        Console.Error.WriteLine($"SetWindowPos with original screen coordinates: ({originalScreenX}, {originalScreenY})");
                    }
                }
                
                // Final verification - check if window is actually visible
                bool isNowVisible = IsWindowVisible(childHwnd);
                System.Drawing.Rectangle finalRect;
                bool gotFinalRect = GetClientRect(childHwnd, out finalRect);
                string finalRectInfo = gotFinalRect ? $"{finalRect.Width}x{finalRect.Height}" : "unknown";
                
                // Also check parent's client area to verify window is within bounds
                System.Drawing.Rectangle parentRect;
                bool gotParentRect = false;
                if (parentHwnd != IntPtr.Zero)
                {
                    gotParentRect = GetClientRect(parentHwnd, out parentRect);
                    if (gotParentRect)
                    {
                        Console.Error.WriteLine($"Parent client area: {parentRect.Width}x{parentRect.Height}");
                        // Verify window is within parent bounds
                        bool withinBounds = (clientX >= 0 && clientY >= 0 && 
                                           clientX + width <= parentRect.Width && 
                                           clientY + height <= parentRect.Height);
                        if (!withinBounds)
                        {
                            Console.Error.WriteLine($"WARNING: Window position ({clientX}, {clientY}) size {width}x{height} exceeds parent bounds!");
                        }
                    }
                }
                
                Console.Error.WriteLine($"Window state after show: Visible={isNowVisible}, Size={finalRectInfo}, Position relative to parent: ({clientX}, {clientY})");
                
                // Flush all debug output before SUCCESS
                Console.Out.Flush();
                Console.Error.Flush();
                Console.WriteLine("SUCCESS");
                Console.Out.Flush();
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

