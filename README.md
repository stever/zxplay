# JSSpeccy 3

A ZX Spectrum emulator for the browser.
See Addendum for the motivation of this fork.

## Features

* Emulates the Spectrum 48K, Spectrum 128K and Pentagon machines
* Handles all Z80 instructions, documented and undocumented
* Cycle-accurate emulation of scanline / multicolour effects
* AY and beeper audio
* Loads SZX, Z80 and SNA snapshots
* Loads TZX and TAP tape images (via traps only)
* Loads any of the above files from inside a ZIP file
* 100% / 200% / 300% and fullscreen display modes
* Three different color schemes

## Implementation notes

JSSpeccy 3 is a complete rewrite of JSSpeccy to make full use of the web technologies and APIs available as of 2021 for high-performance web apps. The emulation runs in a Web Worker, freeing up the UI thread to handle screen and audio updates, with the emulator core (consisting of the Z80 processor emulation and any auxiliary processes that are likely to interrupt its execution multiple times per frame, such as constructing the video output, reading the keyboard and generating audio) running in WebAssembly, compiled from AssemblyScript (with a custom preprocessor).

## Contributions

These days, releasing open source code tends to come with an unspoken social contract, so I'd like to set some expectations...

This is a personal project, created for my own enjoyment, and my act of publishing the code does not come with any commitment to provide technical support or assistance. I'm always happy to hear of other people getting similar enjoyment from hacking on the code, and pull requests are welcome, but I can't promise to review them or shepherd them into an "official" release on any sort of timescale. Managing external contributions is often the point at which a "fun" project stops being fun. If there's a feature you need in the project - feel free to fork.

## Embedding

JSSpeccy 3 is designed with embedding in mind. To include it in your own site, download [a release archive](https://github.com/cronomantic/jsspeccy3/releases) and copy the contents of the `jsspeccy` folder somewhere web-accessible. Be sure to keep the .js and .wasm files and the subdirectories in the same place relative to jsspeccy.js.

In the `<head>` of your HTML page, include the tag

```html
    <script src="/path/to/jsspeccy.js"></script>
```

replacing `/path/to/jsspeccy.js` with (yes!) the path to jsspeccy.js. At the point in the page where you want the emulator to show, place the code:

```html
    <div id="jsspeccy"></div>
    <script>JSSpeccy(document.getElementById('jsspeccy'))</script>
```

If you're suitably confident with JavaScript, you can put the call to `JSSpeccy` anywhere else that runs on page load, or in response to any user action.

You can also pass configuration options as a second argument to `JSSpeccy`:

```html
    <script>JSSpeccy(document.getElementById('jsspeccy'), {zoom: 2, machine: 48})</script>
```

The available configuration options are:

* `autoStart`: if true, the emulator will start immediately with no need to press the play button. Bear in mind that browser policies usually don't allow enabling audio without a user interaction, so if you enable this option (and don't put the `JSSpeccy` call behind an onclick event or similar), expect things to be silent.
* `autoLoadTapes`: if true, any tape files opened (either manually or through the openUrl option) will be loaded automatically without the user having to enter LOAD "" or select the Tape Loader menu option.
* `tapeAutoLoadMode`: specifies the mode that the machine should be set to before auto-loading tape files. When set to 'default' (the default), this is equivalent to selecting the Tape Loader menu option on machines that support it; when set to 'usr0', this is equivalent to entering 'usr0' in 128 BASIC then LOAD "" from the resulting 48K BASIC prompt (which leaves 128K memory paging available without the extra housekeeping of the 128K ROM - this mode is commonly used for launching demos).
* `machine`: specifies the machine to emulate. Can be `48` (for a 48K Spectrum), `128` (for a 128K Spectrum), or `5` (for a Pentagon 128).
* `palette`: specifies the color palette to use. Can be `0` (the standard palette defined by the original author), `1` (for the RGB palette of the 128k and upwards models), or `2` (for the YUV palette of the Spectrum 16K, 14K, and Plus, calculated from the voltages exposed in Chris Smith’s book).
* `openUrl`: specifies a URL, or an array of URLs, to a file (or files) to load on startup, in any supported snapshot, tape or archive format. Standard browser security restrictions apply for loading remote files: if the URL being loaded is not on the same domain as the calling page, it must serve [CORS HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) to be loadable.
* `zoom`: specifies the size of the emulator window; 1 for 100% size (one Spectrum pixel per screen pixel), 2 for 200% size and so on.
* `sandbox`: if true, all UI options for opening a new file are disabled - useful if you're showcasing a specific bit of Spectrum software on your page.
* `tapeTrapsEnabled`: if true (the default), the emulator will recognise when the tape loading routine in the ROM is called, and load tape files instantly instead.
* `language`: Selects the language for the UI, currently `en` for English and `es` for Spanish.

For additional JavaScript hackery, the return value of the JSSpeccy function call is an object exposing a number of functions for controlling the running emulator:

```html
    <script>
        let emu = JSSpeccy(document.getElementById('jsspeccy'));
        emu.openFileDialog();
    </script>
```

* `emu.setZoom(zoomLevel)` - set the zoom level of the emulator
* `emu.enterFullscreen()` - activate full-screen mode
* `emu.exitFullscreen()` - exit full-screen mode
* `emu.toggleFullscreen()` - enter or exit full-screen mode
* `emu.setMachine(machine)` - set the emulated machine type
* `emu.setPalette(palette)` - set the palette used
* `emu.openFileDialog()` - open the file chooser dialog
* `emu.openUrl(url)` - open the file at the given URL
* `emu.exit()` - immediately stop the emulator and remove it from the document

By default, the navigators usually apply a smoothing algorithm when a canvas is scaled and the result is a blurry image.

If you don't like that and prefer a pixelated look when the window is scaled, use these hints on the stylesheet for the container of the emulator:

```css
    #jsspeccy {
            image-rendering: -moz-crisp-edges;
            image-rendering: -webkit-crisp-edges;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
    }
```

## Addendum

First of all, I am very impressed with this piece of work and congratulations are in order to Matt Wescott for his efforts on this emulator.

However, I decided to make a 'soft fork' because I have some gripes with the palette elected by Wescott to represent the ZX Spectrum colors.
In my humble opinion, the most faithful one is the one described [here](https://en.wikipedia.org/wiki/ZX_Spectrum_graphic_modes#Colour_palette), and most of my acquaintances of the scene share the same sentiment.
The RGB values described on the previous link are most likely calculated by measuring voltages on the RGB output of the 128k models, since the ULAs of those systems generate RGBI signals that later are encoded to composite by the TEA2000 IC.
Those are the colors that most emulators use and most people are used to; so with that motivation, I decided to make this fork.
However, since your mileage may vary, I made the original palette also selectable if you favor it.

The ULA of the previous models to the 128k generated the composite signal directly, and generating the colors on composite video is a tricky thing.
The colors are not generated as RGB, but as [YUV](https://en.wikipedia.org/wiki/YUV), a different color space.
So, I also decided to add a palette converted from the YUV values described on [Chris Smith's excellent book](http://www.zxdesign.info/book/) and translated to RGB.

In short, you have three possible color combinations to choose from on the upper menu. I also added the corresponding configuration option and Javascript function to select the palette outside the emulator. All is documented upwards.

Also, I have added translations to the texts on the emulator if you need to localize your instance.
I only have translations for English and Spanish so if you can provide translations for more languages, feel free to put a pull request.
You can find the localization files at `/runtime/i18n`.

Be warned that this is just a fun little weekend project, so I will not develop it further more.
I will try to keep it in line with Wescott's main project, but I don't make any promises on that regard.
What Wescott stated on the Contributions section still apply here.

Hope this could be of some use for anyone.

## Licence

JSSpeccy 3 is licensed under the GPL version 3 - see COPYING.
