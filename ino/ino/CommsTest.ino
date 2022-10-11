
/*
A Test of serial communication between Arduino and Web Serial via Electron
*/

// Set this to the same rate in SerialController
#define BAUDRATE 115200

// Arduino LED pin for debuggin whether data is being sent
#define STATUS_LED_PIN 13

/**
 * @brief Send a command to the Arduino
 *
 * @param command as String to send to Serial Device
 */
void CommandSend(String command)
{
	// combine arrays
	// combined =
	for (int i = 0; i < command.length(); i++)
	{
		Serial.write(command[i]);
	}
	Serial.write("\r");
}

/**
 * @brief Create the Base application
 * 			- define the variables and modes of operation for the pins
 *
 */
void setup()
{
	Serial.begin(BAUDRATE);

	//   pinMode(STATUS_LED_PIN, OUTPUT);

	//   for (byte i = 0; i < (sizeof(thermostatPins) / sizeof(thermostatPins[0])); i++) {
	//     pinMode(thermostatPins[i], INPUT_PULLUP);
	//   }

	//   for (byte i = 0; i < (sizeof(lightSwitchPins) / sizeof(lightSwitchPins[0])); i++) {
	//     pinMode(lightSwitchPins[i], INPUT_PULLUP);
	//   }

	//   for (byte i = 0; i < (sizeof(socketSwitchPins) / sizeof(socketSwitchPins[0])); i++) {
	//     pinMode(socketSwitchPins[i], INPUT_PULLUP);
	//   }

	//   pinMode(DIMMER_PIN, INPUT);
	//   pinMode(RADIATOR_PIN, INPUT);
	//   pinMode(WINDOW_PIN, INPUT_PULLUP);
}

/**
 * @brief LOOP EVERY FRAME - send out different information at different rates...
 * 
 */
void loop()
{
	static uint32_t ledUpdate, fakeSignalUpdate;

	StatusLED();

	delay(10);

	if (millis() > fakeSignalUpdate + 1000)
	{
		CommandSend("T " + String(random(99)) + "\n");
		fakeSignalUpdate = millis();
	}
}

/**
 * @brief Set the LED on the Ardiuno off / on
 * 
 */
void StatusLED()
{
	static unsigned long millisPreviousStatusLED;

	if ((millis() - millisPreviousStatusLED) >= 500)
	{
		millisPreviousStatusLED = millis();
		digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
	}
}
