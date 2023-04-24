const fs = require("fs");

//Read package.json file
fs.readFile("package.json", (err, data) => {
  if (err) throw err;

  //Parse the file contents
  let packageJSON = JSON.parse(data);

  console.log("DXB Current Version: ", packageJSON.version);
  //Increment the version attribute
  let version = packageJSON.version.split(".");
  if (version[2] == 9) {
    version[2] = 0;
    if (version[1] == 9) {
      version[1] = 0;
      version[0]++;
    } else {
      version[1]++;
    }
  } else {
    version[2]++;
  }
  packageJSON.version = version.join(".");
  console.log("DXB New Version: ", packageJSON.version);

  //Write the updated package.json file
  fs.writeFile("package.json", JSON.stringify(packageJSON, null, 4), (err) => {
    if (err) throw err;
  });
});
