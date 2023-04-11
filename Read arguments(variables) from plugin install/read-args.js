var fs = require('fs'), path = require('path');
const semver = require('semver');

const getConfigParser = (context, configPath) => {
      let ConfigParser;

      if (semver.lt(context.opts.cordova.version, '5.4.0')) {
        ConfigParser = context.requireCordovaModule('cordova-lib/src/ConfigParser/ConfigParser');
      } else {
        ConfigParser = context.requireCordovaModule('cordova-common/src/ConfigParser/ConfigParser');
      }

      return new ConfigParser(configPath);
    };

module.exports = function(context) {

    const args = process.argv

    var license;
    for (const arg of args) {  
      if (arg.includes('ANAGOG_IOS_API_KEY')){
        var stringArray = arg.split("=");
        license = stringArray.slice(-1).pop();
      }
    }
    
    const projectRoot = context.opts.projectRoot;
    const platformPath = path.join(projectRoot, 'platforms', 'ios');
    const config = getConfigParser(context, path.join(projectRoot, 'config.xml'));

    let projectName = config.name();
    let projectPath = path.join(platformPath, projectName);

    var swiftFile = path.join(projectPath, 'Plugins/cordova-plugin-anagog-jedai/JemaWrapper.swift');
    
    if (fs.existsSync(swiftFile)) {
     
      fs.readFile(swiftFile, 'utf8', function (err,data) {
        
        if (err) {
          throw new Error('>>> Unable to read JemaWrapper.swift: ' + err);
        }
        
        var result = data.replace(/let API_KEY = ""/g, 'let API_KEY = "' + license + '"');
        
        fs.writeFile(swiftFile, result, 'utf8', function (err) {
        if (err) 
          {throw new Error('>>> Unable to write into JemaWrapper.swift: ' + err);}
        else 
          {console.log(">>> JemaWrapper.swift edited successfuly <<<");}
        });
      });
    } else {
        throw new Error(">>> WARNING: JemaWrapper.swift was not found <<<");
    }
}

