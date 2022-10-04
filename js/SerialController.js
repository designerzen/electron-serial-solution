/**
 * SerialController for communicating with Serial Device
 * written by designerzen@gmail.com
 * 
 * debug:
 * about://device-log
 * 
 * docs:
 * https://wicg.github.io/serial
 * 
 * electron:
 * https://www.electronjs.org/docs/latest/tutorial/devices#web-serial-api
 * 
 */

// Can be overwritten in connect()
const DEFAULT_OPTIONS = {

    // A positive, non-zero value indicating the baud rate 
    // at which serial communication should be established.
    baudRate: 115200, //9600,

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

// A container for holding stream data until a new line.
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
        //console.log("transform", {lines, chunk} , this.chunks )
       
        lines.forEach((line, i) =>{ 
            //console.log(i, "Adding chunk", chunk, "->", line )
            controller.enqueue(line)
        })
    }
  
    flush(controller) {
        // When the stream is closed, flush any remaining chunks out.
        //console.log("Finished chunking", controller)
        controller.enqueue(this.chunks)
    }
}

export default class SerialController {
    
    isOpen = false
    isReading = false
    isWriting = false
    isContinuouslyReading = false

    get isAvailable(){
        return 'serial' in navigator
    }

    get isConnected(){
        // this.port?.readable
        return !!(this.port && ( this.port.readable ||  this.port.writable )) 
    }
    get isReadable(){
        return !!this.port?.readable
    }

    /**
     * Speak with the Serial port
     * @param {*} useTextDecoder If you can't manage to get the data to read - set this to true
     */
    constructor( useTextDecoder=false, decoderDelimiter="\n" ) {
        this.encoder = new TextEncoder()
        this.decoder = new TextDecoder()
    
        if (useTextDecoder)
        {
            this.textDecoder = new TextDecoderStream()
            this.stringDecoder = new TransformStream(new LineBreakTransformer(decoderDelimiter))
            console.log("TextDecoderStream", this.textDecoder.readable, "stringDecoder", this.stringDecoder)
        }
    } 

	async requestPort() {
		return await navigator.serial.requestPort()
	}

	async waitForPort() {
		return new Promise( async (resolve,reject)=>{

			const ports = await navigator.serial.getPorts()
			
			if ( ports && ports.length>0 )
			{
				// find our correct port???
				console.log("Serial ports connected", ports )
				resolve(ports[0])

			}else{
				console.log("No Serial ports connected" )
				
				// check to see if the port is available if not wait for connection...
				navigator.serial.addEventListener("connect", async (event) => {
					const port = event.target

					console.log("Serial port now connected", {event, port} )
					
					resolve(port)
				})	

				// TODO : Timeout or just flat our reject?
			}
		})
	}
  
    async connect( options={}, onDisconnect=null ) {
        if (this.isAvailable) 
		{
			let port
			
			try{

				// firstly attempt to use any devices that have already been granted permissions
				port = await this.waitForPort()
				
			}catch(error){

				// if no device is preset
				try{
					port = await this.requestPort()
				}catch (e){
					throw Error("Connection to navigator.serial.requestPort() denied")
				}
			}

			if (port)
			{
				console.log("Serial port found", { port} )

				// Wait for the serial port to open.
				// TODO: Automatically open port or warn user a port is available.
				// Once you have a SerialPort object, calling port.open() with the desired baud rate will open the serial port.
				// Now attempt to connect to this specific port
				try{
					await port.open({...DEFAULT_OPTIONS, ...options})    
				}catch (e){
					throw Error("Could not open Port Lock read:"+port.readable.locked + " write:" +port.writable.locked )
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

					this.disconnectHandler = onDisconnect
					
					// these are useful to connect to if multiple devices are connected
					// as you can target them directly by id on refresh :)
					const { usbProductId, usbVendorId } = port.getInfo()
					// console.log( { usbProductId, usbVendorId, signals} );
					return {
						connected:true,
						usbProductId, 
						usbVendorId
					}
				}
				catch (err) {
					console.error("Serial port couldn't locate an arduino", { port} )
					throw Error('There was an unexpected error opening the serial port:'+ err)
				}

			}else{

				console.error("Serial port couldn't be found" )
				throw Error('No Port found on WebSerial')
			}

        }
        else {
            console.error('Web serial doesn\'t seem to be enabled in your browser. Try enabling it by visiting:')
            console.error('chrome://flags/#enable-experimental-web-platform-features')
            console.error('opera://flags/#enable-experimental-web-platform-features')
            console.error('edge://flags/#enable-experimental-web-platform-features')
            throw Error('Web serial doesn\'t seem to be enabled in your browser')
        }
    }

    // once reading has completed, you will want to release the read lock
    unlock(){
        console.log("SERIAL port Unlocked", this.reader)
        this.reader.releaseLock()
        this.isReading = false
    }

    async write(data) {
        if (!this.writer){
            return
            //throw Error("The SerialController is not available")
        }

        if (this.isReading)
        {
            // may be neccessary???
            //this.unlock()
            console.error("Tried to write to Serial but serial port is busy being read")
        }else{
            
        }

        this.isWriting = true
        const dataArrayBuffer = this.encoder.encode(data)
        const output = await this.writer.write(dataArrayBuffer)
        this.onWritingCompleted()
        return output
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
            console.error(errorMessage)
            return errorMessage
        }
    }

    /**
     * Keep reading while we can - useful in cases where the port closes
     */
    async readUntilClosed() {
        let streamClosed
        while (this.port.readable && keepReading) 
        {
          const decoder = new TextDecoderStream()
          streamClosed = this.port.readable.pipeTo(decoder.writable)
          reader = decoder.readable.getReader()
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
            reader.releaseLock();
          }
        }
      
        await streamClosed.catch(reason => {
          // Ignore `reason`, it will be whatever object was passed to reader.close().
        })
        await port.close()
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
            console.log("Tried to read Serial but serial port is busy reading")
        }
    }

	/**
	 * Prevent any further continuous data fetching
	 */
    cancelContinuousRead(){

        this.abortController.abort()       
		this.isContinuouslyReading = false
        this.continuousCallback = null
    }

    /**
     * read data from web serial port in chunks
     * and reassemble it into a valid data string
     * @returns {string} data / error ,essage
     */
    async readCommands( callback ) {
      
        if (!this.port || !this.port.readable)
        {
            console.warn("SerialController.readCommands() Failed : "+this.port.readable ? "Port wonky" : "Port not readable" )
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

        // console.log("Serial readCommands readable:", this.port.readable, {port:this.port, cancelling, aborted:signal.aborted, loop:this.port.readable && !signal.aborted && !cancelling} )

        // pause the whole operation until the port is readable
        while ( this.open && this.port.readable && !signal.aborted && !cancelling ) {
            
            // const decoder = new TextDecoderStream()
            // const streamClosed = this.port.readable.pipeTo(decoder.writable)
            // const reader = decoder.readable.getReader()
            const reader = this.reader

            console.log("Serial read loop, reader", this.port.readable , {reader}, !signal.aborted && !cancelling )
                        
            try {
                // pause the operation again until the "done" signal is received
                // this may take many loops but eventually the arduino will proclaim
                // the the next byte will be the last byte of the data and it will be "done"
                while (!signal.aborted && !cancelling) {
                    
                    const outcome = await reader.read()
                  
                    if (outcome.done) 
                    {
                        //console.log("Cancelled Serial read completed (arduino sent complete bit)")
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
                        console.log("Serial RECEIVED COMMAND : ", {outcome,result} )
                            
                        // send only last packet
                        callback && callback(result)

                    }else{
                        console.log("Serial RECEIVED EMPTINESS : ", outcome )
                    }
                }

            } catch (error) {

                // Handle non-fatal read error.  
                const errorMessage = `error reading data: ${error}`
                console.error(errorMessage)

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
            console.log("Cancelled Serial reading!")
            this.unlock()
        }
    }

    // writing has completed
    onWritingCompleted(){
        
        this.isWriting = false

        if (this.isContinuouslyReading)
        {
            console.log("Serial WRITE complete - now remonitoring read...",  {isReading:this.isReading} )
            // if we want to start reading again...
            this.readCommands(this.continuousCallback)
        }else{
            console.log("Serial WRITE completed",  {isReading:this.isReading} )
        }
    }
}