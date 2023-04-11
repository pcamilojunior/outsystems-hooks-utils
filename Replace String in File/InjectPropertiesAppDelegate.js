var fs = require('fs'), path = require('path');

module.exports = function(context) {
    var appDelegate = path.join(context.opts.projectRoot, "platforms", "ios", "ANB Mobile", "Classes", "AppDelegate.h");
    console.log("✅ appDelegate: " + appDelegate);    
    if (fs.existsSync(appDelegate)) {
     
      fs.readFile(appDelegate, 'utf8', function (err,data) {
        
        if (err) {
          throw new Error('🚨 Unable to read AppDelegate: ' + err);
        }
        
        var result = data;
        var shouldBeSaved = false;

        if (!data.includes("BUILD_LIBRARY_FOR_DISTRIBUTION")){
          shouldBeSaved = true;
          result = data.replace(/end/g, "post_install do |installer|\n\tinstaller.pods_project.targets.each do |target|\n\t\tif ['iProov', 'Socket.IO-Client-Swift', 'Starscream'].include? target.name\n\t\t\ttarget.build_configurations.each do |config|\n\t\t\t\t\tconfig.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'\n\t\t\t\tend\n\t\tend\n\tend\nend");
        } else {
          console.log("🚨 AppDelegate already modified");
        }

        if (shouldBeSaved){
          fs.writeFile(appDelegate, result, 'utf8', function (err) {
          if (err) 
            {throw new Error('🚨 Unable to write into AppDelegate: ' + err);}
          else 
            {console.log("✅ AppDelegate edited successfuly");}
        });
        }

      });
    } else {
        throw new Error("🚨 WARNING: AppDelegate was not found. The build phase may not finish successfuly");
    }
  }
