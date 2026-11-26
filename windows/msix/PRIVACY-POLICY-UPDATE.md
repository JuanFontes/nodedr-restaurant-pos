# Privacy policy update needed before the Store submission

**Why.** Store policy 10.5.1 says Desktop Bridge / Win32 products must have a privacy policy and keep it current
([Microsoft Store Policies 7.20](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies)).
The live page, `https://orderrestro.nodedr.com/privacy`, describes the Windows app only as a thin client that
stores a server address. Since the "Start on this computer" mode, the app also runs a local database and server
on the PC and stores the restaurant's data there. The policy must say so.

**What is verified in the code** (so the wording below is true):

- The launcher's only network calls are a reachability check of the server address the user typed, and calls to
  `127.0.0.1`. It has no analytics, telemetry or crash upload.
- A crash writes a log file under `%LOCALAPPDATA%\OrderRestro\logs` and nothing else.
- Postgres listens on `127.0.0.1` only. The web and API servers listen on the LAN so the restaurant's other devices
  can connect.
- In 1.0.20.0 the local server no longer contacts GitHub to look for releases (it used to when an administrator
  opened the dashboard). Before that version, the policy would also have had to say so.

**Where.** Source: `acweb/orderrestro.nodedr.com/app/privacy/page.tsx` (the Windows section, lines ~24-29).
Deploying it publishes the live site, so it needs your go-ahead. It was not changed.

## Replacement text for the Windows section

Keep the heading and the answer **No** to "Does this product access, collect, or transmit personal information?"
Replace the list under "Concretely" with:

> - The app contains **no analytics, telemetry, advertising or crash-reporting SDK** of any kind. Nothing about how
>   you use the app, and nothing you type into it, is sent to us.
> - The app works in one of two ways, which you choose on first start:
>   - **Connect to my existing server.** The app stores only the server address you enter (for example
>     `http://192.168.1.50:1995`) in `%LOCALAPPDATA%\OrderRestro\config.json`, and connects only to that address.
>   - **Start on this computer.** The app runs its own database and server on this PC. Everything you enter (orders,
>     menu, customers, staff accounts, reports, uploaded images) is stored on this PC under
>     `%LOCALAPPDATA%\OrderRestro`. It is not sent to us or to anyone else. The server also accepts connections from
>     other devices on your own network (for example the restaurant's tablets and kitchen screens), which you
>     control through your network and Windows Firewall.
> - If the app stops unexpectedly it writes a log file on this PC. The file is never sent to us.
> - The app does not connect to any server operated by NODEDR. If you turn on an optional integration yourself (for
>   example a payment provider, e-mail or SMS service, or a cloud backup), the data that feature needs goes to the
>   provider you choose, under your own agreement with them.
> - To remove everything the app stored on a PC, use **File > Remove All Local Data & Uninstall** before
>   uninstalling.
> - WebView2, the Microsoft component that shows the app window, may collect diagnostic data under Microsoft's
>   own privacy terms, as Microsoft Edge does. We do not receive it.

## Also fix

The policy names "NODEDR INFOTECH **PRIVATE** LIMITED"; the Store publisher name is "NODEDR INFOTECH LIMITED".
Use the registered legal name in both places. The site takes it from `site.legalName`.
