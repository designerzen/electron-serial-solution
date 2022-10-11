/**
 * WebSerial Connection Testing and Protocol Debugging by designerzen
 */

import SerialController, {DEFAULT_OPTIONS} from './SerialController.js' 
import { isElectron } from './platform.js'

let serialController

const outputElement = document.querySelector("output")
const outputListElement = document.querySelector("#data-output-list")
const deviceElement = document.querySelector("#device")
const statusElement = document.querySelector("#status")
const connectionStatusElement = document.querySelector("#connection-status")
const connectionOptionsFieldset = document.querySelector("#connect-to-arduino-options")

const selectArduinoDelimiter = document.querySelector("#data-connection-delimiter")
const fieldsetArduinoControls = document.querySelector("#connected-arduino-controls")
const buttonConnectToArduino = document.querySelector("#button-connect-to-arduino")
const buttonDisconnectToArduino = document.querySelector("#button-disconnect-from-arduino")
const buttonSendToArduino = document.querySelector("#button-send-to-arduino")
const buttonReadArduinoCommands = document.querySelector("#button-read-arduino-commands")
const buttonReadArduinoUntilClosed = document.querySelector("#button-read-arduino-until-closed")
const buttonReadArduinoContinuosly = document.querySelector("#button-read-arduino-continuosly")
const buttonReadArduinoCancelContinuosly = document.querySelector("#button-read-arduino-cancel-continuose")
const buttonUnlockArduino = document.querySelector("#button-read-arduino-cancel-continuose")

const inputConnectionOptions = document.querySelector("#data-connection-options")
const inputDataField = document.querySelector("#data-to-send-to-arduino")
const inputUseDecoder = document.querySelector("#data-connection-use-decoder")
const inputReleaseLock = document.querySelector("#data-connection-release-lock")

const backSpace = String.fromCharCode(92)

let useTextDecoder = true

const DELIMITERS = [
	'\n\r',
	'\n',
	'\r',
	'\r\n'
]

const DELIMITER_NAMES = [
	'\\n\\r',
	'\\n',
	'\\r',
	'\\r\\n'
]

let delimiter = DELIMITERS[0]

// const delimiterSanitised = delimitPhrase.replace(/\\/g, '-') 
// const delimiterSanitised = delimitPhrase.replaceAll( backSpace, '-') 


//  ${`C:\\backup\\`}` .replaceAll("-", "\\")
const sanitizeDelimiter = limiter => (limiter.replace(/-/g, backSpace)).replace(/\\\\/g, '\\') // limiter.replaceAll('-', backSpace )

const options = Object.assign( {}, DEFAULT_OPTIONS )

/**
 * This adds a unique data entry to the data list
 * @param {String} data 
 */
const appendArduinoData = data => {
	// outputElement.innerText = data + outputElement.innerText
	let li = document.createElement('li')
	li.innerText = data
	console.log("Data receiving", {outputListElement, data, li } )
	outputListElement.prepend(li)
	// outputListElement.appendChild(li)
}

const connect = async () => {

	serialController = new SerialController( useTextDecoder, delimiter )

	// when run in electron
	if (isElectron())
	{		
		statusElement.innerHTML = "Attempting to connect to WebSerial via Electron"
		console.log("Attempting to connect to WebSerial via Electron", {options} )

		// Question is :
		// Does this have to be set from a user-interaction to connect?
		try{

			const result = await serialController.connect( options, error => {
				// disconnected because ?
				console.error("Connection lost", error )
				statusElement.innerHTML = "Connection to WebSerial Expired"
				// start trying to reconnect?
				// setTimeout( connect, 1000 )
				connectionOptionsFieldset.removeAttribute("disabled")
			})

			console.log("result",result )

			// const port = await navigator.serial.requestPort()
			// const ports = await navigator.serial.getPorts()
			const {connected, usbProductId, usbVendorId } = result

			// Add to whitelist message
			deviceElement.innerHTML = `Arduino with Product Id: <strong>${usbProductId}</strong> Vendor Id: <strong>${usbVendorId}</strong>`
			
			// Show all of the controls
			if (connected)
			{
				// check to see if the /r/n thing works as expected
				fieldsetArduinoControls.removeAttribute("hidden")
				statusElement.innerHTML = `Connected to Arduino via Web Serial`
				connectionStatusElement.innerHTML = `Connected to Arduino via Serial port using delimiter <pre>${delimiter.replaceAll("\\","/")}</pre>`
				
				// disable fieldset contining arduino connection options
				connectionOptionsFieldset.setAttribute("disabled", true)
				
				// hide connect button & show disconnect button
				buttonDisconnectToArduino.removeAttribute("hidden")
				buttonConnectToArduino.setAttribute("hidden", true)
			}else{
				statusElement.innerHTML = `Couldn't connect to the Arduino`
				connectionStatusElement.innerHTML = "Connection to Arduino FAILED" 
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

const disconnect = ()=> {
	const result = serialController.disconnect()
	statusElement.innerHTML = `Electron no longer connected to Serial`
	connectionStatusElement.innerHTML = `Disconnected from Arduino`
	buttonConnectToArduino.setAttribute("hidden", true)
	buttonDisconnectToArduino.removeAttribute("hidden")
	console.log("DISCONNECT : ", result )
}

// Or do we need a human touch? (or HID?)
// now bind to buttons to test each of the SerialController Methods
// selectArduinoDelimiter.addEventListener( 'change', event => {
// 	const value = selectArduinoDelimiter.value
// 	inputConnectionOptions.setAttribute( "value", sanitizeDelimiter(value) )
// 	delimiter = inputConnectionOptions.getAttribute("value")// sanitizeDelimiter( inputConnectionOptions.getAttribute("value") )
// 	event.preventDefault()
// 	console.log("selectArduinoDelimiter",{ value, delimiter } )
// })

// // add each delimiter to the option
// DELIMITERS.forEach( (delimitPhrase, index) => { 
// 	selectArduinoDelimiter.add(new Option(DELIMITER_NAMES[index], delimitPhrase))
// } )


// TODO: Add preselection other than 0
const createSelector = ( select, callback, options=[], optionNames=null ) => {

	select.addEventListener( 'change', event => {
		const value = select.value
		callback( value )
		event.preventDefault()
	})

	select.value = options[0]
	
	// add each delimiter to the option
	options.forEach( (option, index) => { 
		select.add(new Option( optionNames? optionNames[index] : option, option))
	} )
}

createSelector( selectArduinoDelimiter, value =>{

	inputConnectionOptions.setAttribute( "value", sanitizeDelimiter(value) )
	delimiter = inputConnectionOptions.getAttribute("value")// sanitizeDelimiter( inputConnectionOptions.getAttribute("value") )
	console.log("selectArduinoDelimiter",{ value, delimiter } )

}, DELIMITERS, DELIMITER_NAMES )


const selectBaudRate = document.querySelector('#data-connection-baudrate')
createSelector( selectBaudRate, value =>{
	options.baudRate = parseInt(value)
	console.log("selectBaudRate",{ value, options } )
}, [ 115200, 9600 ] )

const selectDataBits = document.querySelector('#data-connection-databits')
createSelector( selectDataBits, value =>{
	options.dataBits = parseInt(value)
	console.log("selectDataBits",{ value, options } )
}, [ 8, 7 ] )

const selectStopBits = document.querySelector('#data-connection-stopbits')
createSelector( selectStopBits, value =>{
	options.stopBits = parseInt(value)
	console.log("selectStopBits",{ value, options } )
}, [ 1, 2 ] )

const selectParity = document.querySelector('#data-connection-parity')
createSelector( selectParity, value =>{
	options.parity = value
	console.log("selectParity",{ value, options } )
}, [ 'none', 'even', 'odd' ] )

const selectFlowControl = document.querySelector('#data-connection-flowcontrol')
createSelector( selectFlowControl, value =>{
	options.parity = value
	console.log("selectFlowControl",{ value, options } )
}, [ 'none', 'hardware' ] )






// 
inputUseDecoder.addEventListener( "change" , event => {
	useTextDecoder = !useTextDecoder
	inputUseDecoder.setAttribute("checked", useTextDecoder)
	console.log("Decoder...", {inputUseDecoder, event, useTextDecoder})
} )
inputUseDecoder.setAttribute("checked", useTextDecoder)

// Read Commands from the Arduino
buttonReadArduinoCommands.addEventListener( "click" , event => serialController.readCommands( data => {
	statusElement.innerHTML = `SerialController.readCommands:Data received <strong>${data}</strong>, Connected <strong>${serialController.isConnected}</strong>, Readable <strong>${serialController.isReadable}</strong>, Reading <strong>${serialController.isReading}</strong>, Writing <strong>${serialController.isWriting}</strong>`
	appendArduinoData( data )
	event.preventDefault()
}) )

// This allows one arduino to flood this method - without interuptions
buttonReadArduinoContinuosly.addEventListener( "click" , event => serialController.continuouslyRead( data => {
	statusElement.innerHTML = `SerialController.continuouslyRead:Data received <strong>${data}</strong>, Connected <strong>${serialController.isConnected}</strong>, Readable <strong>${serialController.isReadable}</strong>, Reading <strong>${serialController.isReading}</strong>, Writing <strong>${serialController.isWriting}</strong>`
	// shove the data into the data receiving window
	appendArduinoData( data )
	event.preventDefault()
}))

// This should revert the above
buttonReadArduinoCancelContinuosly.addEventListener( "click" , event => serialController.cancelContinuousRead() )


// Send the data in the field to the Arduino
buttonSendToArduino.addEventListener( "click" , async (event) =>{
	const dataToSend = inputDataField.value
	const releaseLock = !!(inputReleaseLock.value)
	const result = await serialController.write(dataToSend, releaseLock ) 
	console.log("Writing data to arduino", {dataToSend, inputDataField, result, releaseLock})
	inputDataField.value = ''
	connectionStatusElement.innerHTML = `SerialController.write(${dataToSend})`
	event.preventDefault()
})

inputReleaseLock.setAttribute("checked", true)


// Read until Closed
buttonReadArduinoUntilClosed.addEventListener( "click" , event => serialController.readUntilClosed() )

// Force unlock of the Arduino (if connected)
buttonUnlockArduino.addEventListener( "click" , event => serialController.unlock() )

// Connect to the Arduino 
buttonConnectToArduino.addEventListener( "click" , event => connect() )
buttonDisconnectToArduino.addEventListener( "click" , event => disconnect() )
