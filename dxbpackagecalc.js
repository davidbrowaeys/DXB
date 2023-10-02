const fs = require("fs");

//Read package.json file
fs.readFile("package.json", (err, data) => {
  if (err) throw err;

  const releaseBranch = process.argv.length >= 2 ? process.argv[2] : undefined;
  const releaseType = process.argv.length >= 2 ? process.argv[3] : undefined;

  //Parse the file contents
  let packageJSON = JSON.parse(data);

  console.log("DXB Current Version: ", packageJSON.version);
  
  //if release type is beta then increment and add beta other
  let releaseVersion = releaseBranch.split("release/")[1];
  if (releaseType === 'beta'){
    releaseVersion += '-beta';
    packageJSON.version = releaseVersion;
  }else{
    packageJSON.version = packageJSON.version.split('-beta')[0];
  }
  console.log("DXB New Version: ", packageJSON.version);

  //Write the updated package.json file
  fs.writeFile("package.json", JSON.stringify(packageJSON, null, 4), (err) => {
    if (err) throw err;
  });
});
