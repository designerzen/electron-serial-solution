// Modules to control application life and create native browser window
const { app, BrowserWindow } = require('electron')
const path = require('path')
const menu = require("./menu.cjs")


// Add your ARDUINO NAMES here
const ARDUINO_NAME_WHITELIST = [
	'Arduino Mega 2560',
	'Arduino Uno',
	'Arduino Duo'
]

// Add your specific ARDUINO IDS here
const ARDUINO_DEVICE_WHITELIST = [
	// Zen's test arduino devices
	'USB\\VID_2341&PID_0042\\851393033313514121E1',
	'USB\\VID_2341&PID_0001\\64936333137351201191',
	// Bolt Tension
	'FTDIBUS\\VID_0403+PID_6001+AB0LR027A\\0000',
	// Energy:
	'USB\\VID_2341&PID_0001\\64936333137351201191',
	// Moving Parts
	'USB\\VID_2341&PID_0042\\85036313430351803230',
	// Bike AV
	'FTDIBUS\\VID_0403+PID_6001+AB0L9UPBA\\0000'
]

const isProduction = process.env.NODE_ENV === "production" || !process || !process.env || !process.env.NODE_ENV
const isDevelopment = true || !isProduction

let mainWindow 

async function createWindow() {

	// If you'd like to set up auto-updating for your app,
	// I'd recommend looking at https://github.com/iffy/electron-updater-example
	// to use the method most suitable for you.
	// eg. autoUpdater.checkForUpdatesAndNotify();

	// Keep a global reference of the window object, if you don't, the window will
	// be closed automatically when the JavaScript object is garbage collected.
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 1560,
		height: 900,
		minWidth: 360,
		minHeight: 450,
		icon: path.join(__dirname, "icons/win/icon.ico"),
		webPreferences: {
			// Two properties below are here for demo purposes, and are
			// security hazard. Make sure you know what you're doing
			// in your production app.
			// nodeIntegration: true,
			// contextIsolation: false,

			// To allow sockets to get out
			// webSecurity: false,
			// allowRunningInsecureContent: true,

			// Spectron needs access to remote module
			//enableRemoteModule: true,
			//
			preload: path.join(__dirname, 'preload.cjs')
		}
	})

	// Emitted when the window is closed.
	mainWindow.on("closed", () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null
	})

	const session = mainWindow.webContents.session

	// console.log(session)

	// ----------- serial ----------------------------------

	// https://www.electronjs.org/docs/latest/tutorial/devices#web-serial-api
	
	session.on('select-serial-port', (event, portList, webContents, callback) => {

		// console.log('select-serial-port', {event, portList, webContents, callback})

		//Add listeners to handle ports being added or removed before the callback for `select-serial-port`
		//is called.
		session.on('serial-port-added', (event, port) => {
			
			// Optionally update portList to add the new port
			// if no arduino was connected previously
			if (portList.length <1)
			{
				console.log('serial-port-added FIRED WITH', port)
				callback(port)
			}else{
				console.log('serial-port-added FIRED WITH', port)
			}
		})
	
		session.on('serial-port-removed', (event, port) => {
			console.log('serial-port-removed FIRED WITH', port)
			//Optionally update portList to remove the port
		})

		event.preventDefault()

		// if there is only one - let's assume it is the right device
		if (portList && portList.length > 0)
		{
			
			if (portList.length === 1)
			{

				console.log('[SOLO] select-serial-port:', portList[0])
				callback(portList[0].portId)
				
			}else{

				let choice
				portList.forEach( port => {
					console.log('[MULTIPLE] select-serial-port:', port)
					// TODO: HARDCODE
					// WHITELIST choices
				})

				// const result = ARDUINO_NAME_WHITELIST.find( name => name===details.device.name )

				// console.log("Serial Device Found", {result}, details.device.name , details.device.device_instance_id )


				// try and find one that looks correct...
				callback(choice ? choice : portList[portList.length - 1].portId )
			}

		}else{

			console.warn('Could not find any ARDUINOS')
			callback('') //Could not find any matching devices
		}
	})

	// This grants permission to the USB devices connected
	session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
		
		// console.warn('session.setPermissionCheckHandler', {webContents, permission, requestingOrigin, details})
		console.warn('session.setPermissionCheckHandler', {details})

		//  permission, requestingOrigin, 
		switch(permission)
		{
			case "hid":
				return true

			case "serial":
				// (details.securityOrigin === 'file:///')
				return details.isMainFrame
		}
		return false
	})

	
	// setCertificateVerifyProc: [Function: setCertificateVerifyProc],
	// setPermissionRequestHandler: [Function: setPermissionRequestHandler],
	// setBluetoothPairingHandler: [Function: setBluetoothPairingHandler],
	/*
	session.setPermissionRequestHandler((webContents, permission, requestingOrigin, details) => {
		
		switch(permission)
		{
			case "hid":
				return true
 
			case "serial":
				// (details.securityOrigin === 'file:///')
				return details.isMainFrame
		}
		return false
	})
*/

	// Check device for permissions
	session.setDevicePermissionHandler((details) => {
		switch(details.deviceType)
		{
			case "serial":
				
				let result = ARDUINO_NAME_WHITELIST.find( name => name===details.device.name )

				if (result)
				{
					// we have found one of our WHITELISTED arduino devices and wish to 
					// tell the Electron app that we want to allow connection without further 
					// permissions added
					console.log("session.setDevicePermissionHandler:DEVICE LOCATED",details.device.name, { result, details } )

					return true

				}else{

					result = ARDUINO_DEVICE_WHITELIST.find( name => name===details.device.device_instance_id )
					
					console.log("session.setDevicePermissionHandler:DEVICE NOT WHITELISTED", details.device, ARDUINO_NAME_WHITELIST)
					console.log("session.setDevicePermissionHandler:ID WHITELISTED?", result )

					if (result){
						return true
					}
				}

				// now check to see if this device is in the whitelist...
				
				//console.log("Serial Device Found", {result}, details.device.name , details.device.device_instance_id )
		
				// Always allow this type of device (this allows skipping the call to `navigator.hid.requestDevice` first)
				return false
			
			// Let the kids hack
			case "hid":
				return true
		}
	})
	
	// When an arduino is selected from the dropdown list
	session.on('select-hid-device', (event, details, callback) => {
		event.preventDefault()

		// Now attempt to connect to a device
		// const selectedDevice = details.deviceList.find((device) => {
		//   return device.vendorId === '9025' && device.productId === '67'
		// })
		console.log("EVENT:select-hid-device > HID Device selected", {event, details} )
		
		//callback(selectedPort?.deviceId)
	})
	  
 	mainWindow.loadFile('index.html')

	// console.log("Electron loading", { isProduction, isDevelopment })
	
	// Open the DevTools.
	// Only do these things when in development
	if (isDevelopment) {
		// Reload
		try {
			require("electron-reloader")(module)
		} catch (_) {}
		 
		// Errors are thrown if the dev tools are opened
		// before the DOM is ready
		mainWindow.webContents.once("dom-ready", async () => {
			require("electron-debug")()
			// https://github.com/sindresorhus/electron-debug
			mainWindow.webContents.openDevTools()
	 	})
		
		// Exit cleanly on request from parent process in development mode.
		if (process.platform === "win32") {
		
			process.on("message", (data) => {
				if (data === "graceful-exit") {
					app.quit()
				}
			})
		
		} else {
			process.on("SIGTERM", () => {
				app.quit()
			})
		}
	}
	
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

	createWindow()
	
	app.on('activate', function () {

		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})

})


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') { app.quit() }
})