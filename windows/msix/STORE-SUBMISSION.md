# Microsoft Store submission pack: Nodedr OrderRestro 1.0.19.0

Prepared 2026-11-27. **Nothing here has been submitted.** A person with the Partner Center login does the
steps in section 3. The product already exists in Partner Center (Store ID `9NRG9BVFCMN5`), so this is an
**update submission** to that product.

## 1. The file to upload

| | |
|---|---|
| File | `OrderRestro_1.0.19.0_x64.msixupload` (287 MB; one unsigned `.msix` inside, the Store signs it) |
| SHA-256 | `ab26ba2b8f428cf46b55771de9cc307677e65a660153b888f67b1f774b24dc1d` |
| Built from | commit `25db0b8` on `master`, CI run `45879398828` (both jobs green) |
| Saved at | `~/Downloads/Releases/OrderRestro-MSIX-1.0.19.0/` with `SHA256SUMS.txt` |
| Tested | this exact build, signed variant of the same package, on a real Windows 11 PC (section 2) |

Upload only the `.msixupload`. The other files in that folder (`Install-OrderRestro.*`,
`Repair-OrderRestro.*`, the signed `.msix`) are for sideloading to a customer outside the Store.

## 2. What was checked, and how

Checks against Microsoft's published package requirements
([app package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements)),
done on the actual upload file:

| Requirement | Result |
|---|---|
| Identity `NODEDRINFOTECHLIMITED.NodedrOrderRestro`, Publisher `CN=11C721FC-E399-4888-B532-7BFCD5C491B3` (from Partner Center) | matches |
| Version last (fourth) digit is `0` (the Store reserves it) | `1.0.19.0`, yes |
| All file names ANSI | 29,253 files, 0 non-ASCII names |
| Package size | 287 MB, limit 25 GB |
| Capabilities | only `internetClient` and `runFullTrust`; no other restricted capability, no device capability |
| Upload contains no private test signature | `.msix` inside is unsigned |
| Longest path inside the package | 160 characters |

Run on a real Windows 11 PC (build 26300, Intel i3-1115G4, 7.7 GB RAM), not only in CI:

| Test | Result |
|---|---|
| Fresh install, first start, create account path reachable | works: database created, all migrations applied, backend and web healthy, about 100 s |
| Update over a running older version, with data | works: database row written before the update was still there after; update ready in about 13 s |
| Delete a program file, restart | detected and restored (`restoring 1 program files`), page loads |
| Windows App Certification Kit 10.0.26100.9457, run on this PC | see section 2a |
| Windows Server 2025 CI: build, install, `/login` and 20 web files served, repair test, update test | green |

### 2a. Windows App Certification Kit

WACK_RESULT_PLACEHOLDER

### Not tested (be honest in review)

- Printing a bill or kitchen ticket on a real printer. The listing mentions printing; see section 5.
- A very long Windows user name (the test PC's profile path is short).
- Windows 10 (only Windows 11 and Server 2025 were used).
- The Store's own certification pipeline, which only Partner Center can run.

## 3. Steps in Partner Center

Product → **Update** → new submission. In this order:

1. **Pricing and availability**: unchanged (free). Nothing to do.
2. **Properties**: Category *Business*. Check "System requirements" against section 4.5.
3. **Age ratings**: the previous rating carries over. Policy 11.11.2 (7.20) says it must stay accurate,
   so re-open the questionnaire once and confirm every answer (section 4.6).
4. **Packages**: delete the old package row if the portal asks, then upload the `.msixupload`.
   Expect the notice *"restricted capabilities require approval: runFullTrust"*. It is a warning, not an error.
5. **Store listings (en-us)**: paste the description from `STORE-LISTING.md`, the release notes from 4.3,
   and check the screenshots (section 5).
6. **Submission options → Notes for certification**: paste 4.1. In the restricted-capability box paste 4.2.
7. Review, then **Submit**. Certification for a Desktop Bridge app is a manual review. Microsoft's older
   guidance says up to 5 business days; plan for that.

## 4. Text to paste

### 4.1 Notes for certification

```
Nodedr OrderRestro is a restaurant point-of-sale desktop app (Windows Forms + Microsoft Edge WebView2).
You do NOT need a demo account or any server: you create your own test restaurant.

HOW TO TEST (about 5 minutes)
1. Start the app. On the first screen choose "Start on this computer".
2. Wait. The first start sets up a local database and takes about 2 minutes (longer on slow disks). The
   window shows progress ("Setting up...", "Preparing local database...", "Checking the app files...").
3. When the sign-in page appears, click "Create an account". Enter any restaurant name, branch name, your
   name, an email and a password of 8+ characters. You are signed in to the dashboard.
4. Add a menu item and a table, then take an order from the POS screen; it appears on the kitchen screen.

WHAT RUNS: everything is inside this package. The app starts its own PostgreSQL database (127.0.0.1 only)
and a local web server on this PC (ports 55432, 4001 and 1995). The web and API servers listen on the LAN so
the restaurant's tablets and kitchen screens can connect; Windows may ask to allow network access, and
choosing "Cancel" does not stop the app working on this PC. No code is downloaded. The only network use
beyond this PC is the optional "Connect to my existing server" choice, which needs a server we cannot
provide to testers; the "Start on this computer" mode shows all functions.

runFullTrust: required because this is a Win32/Windows Forms desktop app packaged with the Desktop Bridge,
and it starts its own bundled helper programs (database and web server). It asks for no administrator
rights, installs no service and uses no other restricted capability.

UNINSTALL: File > "Remove All Local Data & Uninstall..." deletes everything the app stored on this PC; then
remove the app from Settings > Apps. Open source (AGPL-3.0): github.com/Raktim94/nodedr-restaurant-pos
```

### 4.2 Restricted capability justification (runFullTrust)

```
Nodedr OrderRestro is a Win32 (.NET, Windows Forms) desktop application packaged with the Desktop Bridge.
runFullTrust is required to run a Win32 process outside an AppContainer. The app uses it to (1) host the
Microsoft Edge WebView2 control and (2) start its own bundled local database and web server as child
processes from files shipped in the package. It does not request elevation, install services or drivers,
or declare any other restricted capability. Source code is public: github.com/Raktim94/nodedr-restaurant-pos
```

### 4.3 What's new in this version

```
- Fixed: on some PCs the first start stayed on "Starting the backend" with a blank window. The app now
  prepares its local data folders correctly.
- The app now checks its own program files at start and repairs a missing or damaged file automatically.
  Your restaurant data is never touched by a repair.
- Updates start much faster.
- If the program files cannot be repaired, a clear message with details is shown instead of a blank window.
```

### 4.4 Description

Use the description in `STORE-LISTING.md`. It was rewritten for this submission to state, at the start, how
the app runs and what it needs (policies 10.1.1 and 10.2.4).

### 4.5 System requirements (measured)

| | Minimum | Measured |
|---|---|---|
| OS | Windows 10 version 1809 or newer | tested on Windows 11 |
| Disk | 2 GB free | program 0.8 GB + local copy 0.6 GB + data |
| Memory | 4 GB | app processes about 0.5 GB on the test PC (an estimate for the minimum, not a measured floor) |
| Other | Microsoft Edge WebView2 Runtime (in Windows 11) | |

### 4.6 Age rating answers (IARC)

The owner answers; these reflect the product as built. No violence, sexual content, profanity, gambling,
drugs or horror. No user-to-user chat and no public user-generated content. No in-app purchases and no
ads. The Windows app shares no location and sends nothing to the publisher. Expected result: lowest
rating. If the answers or the product change, redo the questionnaire (policy 11.11.2).

## 5. Open items for the owner

1. **Privacy policy must be updated before submitting.** Policy 10.5.1 requires a privacy policy for every
   Desktop Bridge / Win32 product and says it must be kept current. `https://orderrestro.nodedr.com/privacy`
   describes the Windows app only as a thin client that stores a server address. This version also runs a
   local database on the PC. Wording to add is in `PRIVACY-POLICY-UPDATE.md`. The page source is
   `acweb/orderrestro.nodedr.com/app/privacy/page.tsx`; it deploys the live site, so it was **not** changed.
2. **Company name mismatch.** The policy says "NODEDR INFOTECH **PRIVATE** LIMITED"; the Store publisher
   display name is "NODEDR INFOTECH LIMITED". Use the real legal name in both.
3. **Printing claim.** The listing says bills and kitchen tickets print on a Windows printer. This was not
   tested on a printer. Either test it or soften the line (policy 10.1.1: describe features accurately).
4. **Screenshots.** At least one is required and Microsoft recommends four or more, PNG, 1366 x 768 or larger
   ([listing screenshots](https://learn.microsoft.com/en-us/windows/uwp/publish/app-screenshots-and-images)).
   The listing already has 7. Check they still match this version, and that none show another company's data.
5. **Wait for the CI run on `master`** to finish for `25db0b8` if you want to use its artifact; the tested
   file is the one from run `45879398828`, which is the one to upload.

## 6. Policy points that apply (Store Policies 7.20, effective 2026-10-22)

Source: [Microsoft Store Policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies).

| Policy | What it means here |
|---|---|
| 10.1.1 accurate listing, no extra keywords | listing states limits (first start time, needs WebView2); 7 keywords at most (10.1.3) |
| 10.2.2 no dynamic code | nothing is downloaded or executed from the internet; all code ships in the package |
| 10.2.3 secondary software | the bundled PostgreSQL and Node.js are part of the product, disclosed in the description |
| 10.2.7 clean uninstall | File > Remove All Local Data & Uninstall, documented in the notes |
| 10.3.1 / 10.3.2 testability | no login or server needed: testers create an account (section 4.1) |
| 10.4.2 start promptly, stay responsive | the first start sets up a database (about 2 minutes) and shows progress text |
| 10.5.1 privacy policy for Desktop Bridge apps | policy exists; needs the update in item 1 |
| 10.6 capabilities must relate to the product | `runFullTrust` and `internetClient` only, justified in 4.2 |
| 11.11 age rating | section 4.6 |

`rescap:unvirtualizedResources` was **not** used to fix the folder problem found in testing. Microsoft says
that capability is for certain games and apps packaged with external location, so approval for an ordinary
app is unlikely. The launcher creates its folders through a child process instead.
