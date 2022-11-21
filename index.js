import SerialPort from "serialport";
import inquirer from "inquirer";
import fs from "fs";
let baselink;
import {
  DfuOperation,
  DfuUpdates,
  DfuTransportSink,
  DfuTransportSerial,
  DfuTransportUsbSerial,
  DfuTransportSlowSerial,
  DfuTransportNoble,
  DfuError,
  ErrorCode,
} from "pc-nrf-dfu-js";
import axios from "axios";
const keypress = async () => {
    process.stdin.setRawMode(true)
    return new Promise(resolve => process.stdin.once('data', () => {
      process.stdin.setRawMode(false)
      resolve()
    }))
  }
async function main() {
  let port;
  port = await findSL12();
  while(port == undefined){
    console.log("Please put ur SL12 in DFU mode and press a key to continue");
    // Wait for user to press enter
    await keypress();
      port = await findSL12();
  }
    console.log("SL12 found");
    let firmwares = await getFimwares();
    //create a inquirer prompt to ask the user which firmware he wants to install
    const { firmware } = await inquirer.prompt([
        {
            type: "list",
            name: "firmware",
            message: "Which firmware do you want to install?",
            choices: firmwares,
        },
    ]);
    const firmwareLink = baselink + firmware;
    console.log("Retrieving firmware from " + firmwareLink);
    await axios({
        url: firmwareLink,
        method: "GET",
        responseType: "stream",
      }).then((response) => {
        // Use the stream to write the file to the filesystem
        response.data.pipe(fs.createWriteStream(firmware));
        response.data.on("end", () => {
          console.log("Firmware downloaded");
          
          flashfirmware(port, firmware);
          
        });
      }).catch(
        function(error) {
          if (error.response) {
            // Request made and server responded
            console.log(error.response.data);
          } else if (error.request) {
            // The request was made but no response was received
            console.log(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.log("Error", error.message);
          }
  
        }
      );
    
    
}
async function flashfirmware(port ,firmware){
    console.log("Preparing to flash firmware");
    let serialNumber = port.serialNumber;
  
    const dfuUpdates = await DfuUpdates.fromZipFilePath(firmware);
    const serialPort = new DfuTransportUsbSerial(serialNumber, 16);
    const dfuOperation = new DfuOperation(dfuUpdates, serialPort);
    console.log("Flashing firmware, this can take up to 30 seconds");
    //flash the firmware 
    await dfuOperation.performDfu();
    console.log("Firmware flashed");
    console.log("Starting clean up");
    await serialPort.close();
    fs.unlinkSync(firmware);
    console.log("Clean up done");
    process.exit(0);
}
async function findSL12() {
  //get all serial ports and filter for SL12 with vendor id 0x1915
  const ports = await SerialPort.list();
  const sl12 = ports.filter((port) => port.vendorId === "1915" && port.productId === "521F");


  if (sl12.length > 1) {
    throw new Error("More than one SL12 found");
  }
  return sl12[0];
}
async function getFimwares(){
    //get all firmware versions from github at https://raw.githubusercontent.com/Kuromis-2/newest-firmware/main/firmwarelookup.json
    const firmwares = await axios.get("https://raw.githubusercontent.com/Kuromis-2/newest-firmware/main/firmwarelookup.json");
    //turn the data into a json object
    
    const firmware = firmwares.data;
    const firmwarearray = [];
    baselink = firmware.baseLink;
    delete firmware.baseLink;
    //create a new array with the key and the value.changelog as the name and the filename as the value
    for (const [key, value] of Object.entries(firmware)) {
        firmwarearray.push({name: key + " " + value.changeLog, value: value.fileName});
    }
  

    return firmwarearray;
    
    
    
    
}
main();
