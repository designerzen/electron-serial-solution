/**
 * SerialController for communicating with Serial Device eg. Arduino
 * written by designerzen@gmail.com
 * version 0.1.3
 * 
 * debug:
 * about://device-log
 * 
 * docs:
 * https://wicg.github.io/serial
 * https://web.dev/serial/
 * https://developer.mozilla.org/en-US/docs/Web/API/SerialPort
 * 
 * electron:
 * https://www.electronjs.org/docs/latest/tutorial/devices#web-serial-api
 * 
 * To operate... create a new instance :
 * 
 * const serialController = new SerialController( useTextDecoder=true, delimiter="\r\n" )
 * serialController.connect( options )
 * 
 */

// Can be overwritten in connect()
export const DEFAULT_OPTIONS = {

    // A positive, non-zero value indicating the baud rate 
    // at which serial communication should be established.
	// eg. 9600
    baudRate: 115200, 

    // The number of data bits per frame
    // dataBits:8 (either 7 or 8).

    // The number of stop bits at the end of a frame 
    // stopBits:1 (either 1 or 2).

    // The parity mode for pairing data
    // parity:none (either "none", "even" or "odd").

    // The size of the read and write buffers that should be created
    // bufferSize:255 (must be less than 16MB).

    // The flow control mode 
    // flowControl:none (either "none" or "hardware").
}

/**
 * A container for holding stream data until a new line or user-specified delimiter
 */
class LineBreakTransformer {

    constructor( decoderDelimiter="\n\r" ) {
        this.chunks = ""
        this.delimiter = decoderDelimiter
        //console.log("LineBreakTransformer", {decoderDelimiter})
    }
  
    transform(chunk, controller) {
           
        // Append new chunks to existing chunks.
        this.chunks += chunk
        
        // For each line breaks in chunks, send the parsed lines out.
        const lines = this.chunks.split( this.delimiter ) 
       
        // kill empty line
        this.chunks = lines.pop()
        //console.log("LineBreakTransformer:transform via",this.delimiter, {lines, chunk} , this.chunks )
       
        lines.forEach((line, i) =>{ 
            //console.log(i, "LineBreakTransformer:Adding chunk", chunk, "->", line )
            controller.enqueue(line)
        })

		//console.log("LineBreakTransformer:transformed", lines , this.chunks )
    }
  
    flush(controller) {
        // When the stream is closed, flush any remaining chunks out.
        //console.log("Finished chunking", controller)
        controller.enqueue(this.chunks)
    }
}

/**
 * Serial Controller - read & write to WebSerial
 */
export default class SerialController {
    
    isOpen = false
    isReading = false
    isWriting = false
    isContinuouslyReading = false
    isDeviceConnected = false
    verbose = false

	port

	encoder
	decoder
	stringDecoder
	textDecoder

    get isAvailable(){
        return 'serial' in navigator
    }

    get isConnected(){
        return !!(this.port && ( this.port?.readable ||  this.port?.writable )) 
    }

    get isWriteable(){
        return !!this.port?.writable
    }

    get isReadable(){
        return !!this.port?.readable
    }
    
    get debug() {
        return this.verbose
    }

    set debug( value ) {
        this.verbose = value
    }

    /**
     * Speak with the Serial port
     * @param {Boolean} useTextDecoder If you can't manage to get the data to read - set this to true
     */
    constructor( useTextDecoder=false, decoderDelimiter="\n\r" ) {

        this.encoder = new TextEncoder()
        this.decoder = new TextDecoder()
    
        if (useTextDecoder)
        {
            this.textDecoder = new TextDecoderStream()
            this.stringDecoder = new TransformStream(new LineBreakTransformer(decoderDelimiter))
            this.log("TextDecoderStream", this.textDecoder.readable, "stringDecoder", this.stringDecoder, "decoderDelimiter", decoderDelimiter)
        }
    } 

    // Logging levels
    log()
    {
        if (this.verbose){ console.log(arguments) }
    }
    error()
    {
        if (this.verbose){ console.error(arguments) }
    }
    warn()
    {
        if (this.verbose){ console.warn(arguments) }
    }


	/**
	 * Request a Port from the list
	 * const filters = [
	 *   { usbVendorId: 0x2341, usbProductId: 0x0043 },
	 *   { usbVendorId: 0x2341, usbProductId: 0x0001 }
	 * ]
	 * @param {Array} filter array containing usbVendorId or usbProductId
	 * @returns {Promise}
	 */
	async requestPort( filters=[] ) {
		return await navigator.serial.requestPort({ filters })
	}

	/**
	 * Request a Port that has already been selected once and has had the 
	 * permission set by the user ahead of this time
	 * @returns {Promise}
	 */
	async waitForPort( filters=[] ) {
		return new Promise( async (resolve,reject)=>{

			const ports = await navigator.serial.getPorts({filters})
			
			if ( ports && ports.length>0 )
			{
				// find our correct port???
				this.log(`SERIAL: ${ports.length} Serial ports found`, ports )
				// loop through filters?
				resolve(ports[0])

			}else{
				this.log("SERIAL: No Serial ports previously registered" )
                
				// TODO : Timeout or just flat our reject?
				reject("No Serial ports previously registered, must use requestPort() first")
			}
		})
	}
  

	/**
	 * Connect to the specific Serial Port
	 * @param {SerialPort} port - Port to connect to
	 * @param {Function} onDisconnect - callback on disconnect
	 * @returns {Object} Connection status and port details
	 */
	async connectToPort( port, options, onDisconnect=null ){

		this.log("SERIAL: Serial port connecting", { port,options, onDisconnect } )

		// Wait for the serial port to open.
		// TODO: Automatically open port or warn user a port is available.
		// Once you have a SerialPort object, calling port.open() with the desired baud rate will open the serial port.
		// Now attempt to connect to this specific port
		try{
			await port.open({...DEFAULT_OPTIONS, ...options})    
		}catch (e){
			throw Error("Could not open Port readable:"+ this.isReadable + " writable:" + this.isWriteable)
		}

		this.log("SERIAL: Serial port connected", { port,options, onDisconnect } )

		if ( onDisconnect )
		{
			port.addEventListener('disconnect', event =>{ 
				this.log("SERIAL: Serial port disconnected", { event, port, options } )
				onDisconnect(port) 
			})
		}

		try{ 
			//const [appPort, devPort] = port.readable.tee()
			const signals = await port.getSignals()    

			// Do we use the in-built line decoder or use our own?
			// NB. the in-built should be sufficient but AVAIF have
			// varied their Serial code and I had to write a custom decoder
			// although this may not be neccessary in the future
			if (this.textDecoder)
			{
				// streamClosed = this.port.readable.pipeTo(decoder.writable)
				this.reader = port.readable
					.pipeThrough( this.textDecoder )
					.pipeThrough( this.stringDecoder )
					.getReader()
			
			}else{

				this.reader = port.readable.getReader()
			}

			this.writer = port.writable.getWriter()
			this.port = port
			this.open = !!port?.readable
			
			// these are useful to connect to if multiple devices are connected
			// as you can target them directly by id on refresh :)
			const { usbProductId, usbVendorId } = port.getInfo()
			// this.log( { usbProductId, usbVendorId, signals} );

			this.isDeviceConnected = true

			return {
				signals,
				connected:true,
				usbProductId, 
				usbVendorId
			}
		}
		catch (err) {
			this.error("Serial port couldn't locate an arduino", { port} )
			throw Error('There was an unexpected error opening the serial port:'+ err)
		}
	}

    /**
     * Connect to the WebSerial Port specified with the specified options
     * @param {Object} options - see the DEFAULT_OPTIONS above for options
     * @param {Function} onDisconnect - callback to call when connection dies
     * @returns {Object} connected, usbProductId, usbVendorId
     */
    async connect( options=DEFAULT_OPTIONS, onDisconnect=null ) {

        if (!this.isDeviceConnected && this.isAvailable) 
		{
			let port
			
			try{
				// firstly attempt to use any devices that have already been granted permissions
				port = await this.waitForPort()
				
			}catch(error){

                this.log("SERIAL: No port found that has previously been registered")
                this.log("SERIAL: Will attempt to query User to determine which device can be accessed")
                //throw Error("No port found that has already been registered")
			}

            if (!port)
            {
				// if no device is preset
				try{
					port = await this.requestPort()
				}catch (e){
                    this.log("SERIAL: Could not access the serial port - perhaps request was denied?")
					//throw Error("SERIAL: Connection to navigator.serial.requestPort() denied : Permission error?")
				}
            }

			if (port)
			{	
				return await this.connectToPort( port, options, onDisconnect )
			}else{
				this.error("Serial port couldn't be found" )
				throw Error('No Port found on WebSerial')
			}

			//return port
        }
        else {
            this.error('Web serial doesn\'t seem to be enabled in your browser. Try enabling it by visiting:')
            this.error('chrome://flags/#enable-experimental-web-platform-features')
            this.error('opera://flags/#enable-experimental-web-platform-features')
            this.error('edge://flags/#enable-experimental-web-platform-features')
            throw Error('Web serial doesn\'t seem to be enabled in your browser')
        }

		// check to see if the port is available if not wait for connection...
		// navigator.serial.addEventListener("connect", async (event) => {
		// 	const port = event.target
		// 	this.log("Serial port now connected", {event, port} )
		// 	await this.connectToPort( port, options, onDisconnect )
		// return port
		// })	
    }

	/**
	 * FIXME: 
	 * Should disconnect the Port and allow another to be selected
	 */
	disconnect(){
		if (this.port)
		{
			this.port.close()
			this.isDeviceConnected = false
			return this.unlock() 
		}
		return false
	}

	/**
	 * Once reading has completed, you will want to release the read lock
	 */
    unlock(){
        this.log("SERIAL port Unlocked", this.reader)
		// cancel any reading streams
		if (this.abortController)
		{
			this.abortController.abort() 
		}
		this.isReading = false
		return this.reader.releaseLock()
    }

	/**
	 * Send Data to the Arduino over web serial
	 * @param {String|Array} data 
	 * @param {Boolean} releaseLock - release writer lock when complete
	 * @returns Serial output
	 */
    async write(data, releaseLock=true) {

		this.log("SERIAL: Writing to port", {data, releaseLock})

		// No Writer available on this Serial Port
        if (!this.writer)
		{
			this.error("Writing to a serial port that hasn't been connected")
            return false
            //throw Error("The SerialController is not available")
        }

        if (this.isReading)
        {
            // may be neccessary???
            //this.unlock()
            this.error("Tried to write to Serial but serial port is busy being read")
        }else{
            
        }

        this.isWriting = true
        const dataArrayBuffer = this.encoder.encode(data)
        await this.writer.write(dataArrayBuffer)

		if (releaseLock)
		{
			this.writer.releaseLock()
			this.isWriting = false
		}

		this.log("SERIAL:Writing to a serial port", { dataArrayBuffer, data })

        this.onWritingCompleted( dataArrayBuffer )
        return dataArrayBuffer
    }

    /**
     * Read only one byte from the decoder
     */
    async readByte(){
        try {
            const readerData = await this.reader.read()
            return this.decoder.decode(readerData.value)
        }
        catch (err) {
            const errorMessage = `error reading data: ${err}`
            this.error(errorMessage)
            return errorMessage
        }
    }

    /**
     * Keep reading while we can - useful in cases where the port closes
     */
    async readUntilClosed() {
        let streamClosed
		let keepReading = true
        while (this.port.readable && keepReading) 
        {
          const decoder = new TextDecoderStream()
          streamClosed = this.port.readable.pipeTo(decoder.writable)
          const reader = decoder.readable.getReader()
          try {
            while (true) {
              const { value, done } = await reader.read()
              if (done) {
                // |reader| has been canceled.
                break
              }
              // Do something with |value|...
            }
          } catch (error) {
            // Handle |error|...
          } finally {
            reader.releaseLock()
          }
        }
      
        await streamClosed.catch(reason => {
          // Ignore `reason`, it will be whatever object was passed to reader.close().
		  keepReading = false
		  this.log("Serial stream closed", reason)
        })
        return await port.close()
    }

    /**
     * This forces a re-read once writing has completed...
     */
    continuouslyRead( callback ){
        this.isContinuouslyReading = true
        this.continuousCallback = callback
        // commence reading
        if (!this.isReading)
        {
            this.readCommands( this.continuousCallback )
        }else{
            this.log("Tried to read Serial but serial port is busy reading")
        }
    }

	/**
	 * Prevent any further continuous data fetching
	 */
    cancelContinuousRead(){

		if (this.isContinuouslyReading)
		{
			this.abortController.abort()       
			this.isContinuouslyReading = false
			this.continuousCallback = null	
			this.log("Cancelliung continuous reading from Serial")
		}else{
			this.log("cancelContinuousRead: Failed - was not connected")
		}
    }

    /**
     * read data from web serial port in chunks
     * and reassemble it into a valid data string
     * @returns {string} data / error ,essage
     */
    async readCommands( callback ) {
      
        if (!this.port || !this.port.readable)
        {
            this.warn("SerialController.readCommands() Failed : "+this.port.readable ? "Port wonky" : "Port not readable" )
            return
        }

        let times = 0
        const commands = []
        let cancelling = false
        
        this.isReading = true

        // allow us to cancel it if needed
        this.abortController = new AbortController()
        
        const signal = this.abortController.signal

        // allow us to exit prematurely
        signal.addEventListener('abort', () => {
            // This wait was interupted by the user selecting another bolt
            // before making a decision about the previous bolt
            cancelling = true
        })

        // this.log("Serial readCommands readable:", this.port.readable, {port:this.port, cancelling, aborted:signal.aborted, loop:this.port.readable && !signal.aborted && !cancelling} )

        // pause the whole operation until the port is readable
        while ( this.open && this.port.readable && !signal.aborted && !cancelling ) {
            
            // const decoder = new TextDecoderStream()
            // const streamClosed = this.port.readable.pipeTo(decoder.writable)
            // const reader = decoder.readable.getReader()
            const reader = this.reader

            this.log("Serial read loop, reader", this.port.readable , {reader}, !signal.aborted && !cancelling )
                        
            try {
                // pause the operation again until the "done" signal is received
                // this may take many loops but eventually the arduino will proclaim
                // the the next byte will be the last byte of the data and it will be "done"
                while (!signal.aborted && !cancelling) {
                    
                    const outcome = await reader.read()
                  
                    if (outcome.done) 
                    {
                        //this.log("Cancelled Serial read completed (arduino sent complete bit)")
                        this.unlock()
                        // exit these loops
                        break
                    }

                    // concantenate the data into one longer string
                    if (outcome.value) 
                    {
                        let result = outcome.value
                    
                        // only decode if no text-decoder
                        if (!this.textDecoder)
                        {
                            const decoded = this.decoder.decode(outcome.value)
                            result = decoded.split("\r\n")[0]
                        }
                       
                        commands.push( result )
                        this.log("Serial RECEIVED COMMAND : ", {outcome,result} )
                            
                        // send only last packet
                        callback && callback(result)

                    }else{
                        this.log("Serial RECEIVED EMPTINESS : ", outcome )
                    }
                }

            } catch (error) {

                // Handle non-fatal read error.  
                const errorMessage = `error reading data: ${error}`
                this.error(errorMessage)

				if (this.disconnectHandler)
				{
					this.disconnectHandler(error)
				}
                // if you want to catch the error higher up with try catch...
                // but this may not be what you want as the error will not prevent
                // the loop repeating
                // throw Error(error);
                return errorMessage

            } finally {
                this.unlock()
            }
        }

        if (cancelling)
        {
            this.log("Cancelled Serial reading!")
            this.unlock()
        }
    }

	/**
	 * EVENT: writing has completed
	 */
    onWritingCompleted(){
        
        this.isWriting = false

        if (this.isContinuouslyReading)
        {
            this.log("Serial WRITE complete - now remonitoring read...",  {isReading:this.isReading} )
            // if we want to start reading again...
            this.readCommands(this.continuousCallback)
        }else{
            this.log("Serial WRITE completed",  {isReading:this.isReading} )
        }
    }
}