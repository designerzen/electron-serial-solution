
import SerialController from './SerialController.js' 
import { isElectron } from './platform.js'

const outputElement = document.querySelector("output")
const deviceElement = document.querySelector("#device")
const statusElement = document.querySelector("#status")

const serialController = new SerialController( true, "\n" )

const connect = async () => {

	// when run in electron
	if (isElectron()){

		console.log("Attempting to connect to WebSerial via Electron")

		// Question is :
		// Does this have to be set from a user-interaction to connect?
		try{
			const result = await serialController.connect({}, error => {
				// disconnected because ?
				console.error("Connection lost", error )
				// start trying to reconnect?
				setTimeout( connect, 1000 )
			})

			// const port = await navigator.serial.requestPort()
			// const ports = await navigator.serial.getPorts()
			const {connected, usbProductId, usbVendorId } = result

			// Add to whitelist message
			deviceElement.innerHTML = `Arduino with Product Id: <strong>${usbProductId}</strong> Vendor Id: <strong>${usbVendorId}</strong>`
			
			if (connected)
			{
				statusElement.innerHTML = `Connected to arduino with product id of ${usbProductId}`

				serialController.continuouslyRead( data => {
	
					// shove the data into the data receiving window
					console.log("Data receiving", {data } )
					outputElement.innerText =  data + "\n" + outputElement.innerText
				})

			}else{

				statusElement.innerHTML = `Couldn't connect to the Arduino`
			}
		
			return true

		}catch(error){

			statusElement.innerHTML = `ULTIMATE:FAILURE > Couldn't connect to the Arduino ` + error
			console.error("Failed to connect to Arduino", error)
			return false
		}

	}else{

		statusElement.innerHTML = `Electron not found so HID interaction is required`
		console.warn("Electron not found so HID interaction is required")
		return false
	}
}

// Or do we need a human touch? (or HID?)
connect()