/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/main/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(createWindow).catch(console.log);

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});

/////////////////////////////////////////
/*            Custom stuffs            */
/////////////////////////////////////////

ipcMain.on('video:download', (event, data) => {
  downloadUrl(data.url, data.name);
});

//require the ffmpeg package so we can use ffmpeg using JS
import ffmpeg from 'fluent-ffmpeg';
//Get the paths to the packaged versions of the binaries we want to use
/*const ffmpegPath = require('ffmpeg-static').replace(
  'app.asar',
  'app.asar.unpacked'
);
const ffprobePath = require('ffprobe-static').path.replace(
  'app.asar',
  'app.asar.unpacked'
);

//tell the ffmpeg package where it can find the needed binaries.
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);*/

const ytdl = require('ytdl-core');
const fs = require('fs');

function downloadUrl(url: string, name: string) {
  const stream = ytdl(url);
  stream.on('info', (i) => {
    console.log(i);
    stream.on('progress', (chunk, downloaded, total) => {
      mainWindow.webContents.send('download:progress', {
        desc: 'Downloading from youtube',
        prog: (downloaded / total) * 100,
      });
      if ((downloaded / total) * 100 == 100) {
        mainWindow.webContents.send('download:progress', {
          desc: 'Youtube download finished',
          prog: 100,
        });
        convertInputOp(name, './converted.wav', function (err) {
          if (!err) {
            console.log('conversion complete');
          }
        });
      }
    });
    stream.pipe(fs.createWriteStream(name));
  });
}

function convertInputOp(input, output, callback) {
  ffmpeg(input)
    .output(output)
    .outputOptions(['-ar 16000', '-f wav', '-ac 1'])
    .on('end', function () {
      console.log('conversion ended');
      mainWindow.webContents.send('download:progress', {
        desc: 'convertion ended',
        prog: 100,
      });
      callback(null);
    })
    .on('error', function (err) {
      console.log('error: ', err.code, err.msg);
      callback(err);
    })
    .on('progress', (prog) => {
      mainWindow.webContents.send('download:progress', {
        desc: 'converting to wav format',
        prog: prog.percent,
      });
    })
    .run();
}

/*async function downloadUrl(url: string, name: string) {
  ytdl.getInfo(url).then((info, err) => {
    if (err) console.log(err);
    console.log(info);
    var stream = ytdl.downloadFromInfo(info, {
      quality: 'highestaudio',
    });
    ffmpeg(stream)
      .audioBitrate(info.formats[0].audioBitrate)
      .withAudioCodec('libmp3lame')
      .toFormat('mp3')
      .saveToFile(`${info.videoDetails.title.replace(/\u20A9/g, '')}.mp3`)
      .on('start', function (commandLine) {
        console.log('Spawned ffmpeg with command ' + commandLine);
      })
      .on('progress', function (progress) {
        console.log('Progress: ' + progress.percent);
      })
      .on('error', function (err) {
        console.log('error', err);
      })
      .on('end', function () {
        console.log('download ended');
      });
  });
}*/
