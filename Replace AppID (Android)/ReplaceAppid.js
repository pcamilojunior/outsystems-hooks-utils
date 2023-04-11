var fs = require('fs');
var path = require('path');

const constants={
    javaSrcPath : path.join("platforms","android","app","src","main","java"),
    kotlinSrcPath : path.join("platforms","android","app","src","main","kotlin"),
    pluginID : path.join("com","outsystems","misnap")
}

module.exports = function (context) {
    
    console.log("Start changing Files!");
    var Q = require("q");
    var deferral = new Q.defer();


    var rawConfig = fs.readFileSync("config.xml", 'ascii');
    var match = /^<widget[\s|\S]* id="([\S]+)".+?>$/gm.exec(rawConfig);
    if(!match || match.length != 2){
        throw new Error("id parse failed");
    }

    const appId = match[1];

    var pathArray = [path.join(constants.javaSrcPath,constants.pluginID,"MiSnap.java")]
    
    pathArray.forEach((value)=>{
        if (fs.existsSync(value)) {
            var content = fs.readFileSync(value, "utf8");
    
            var regexAppId = new RegExp("\\$appid","g");
            content = content.replace(regexAppId,appId);
    
            
            fs.writeFileSync(value, content);
            console.log("Finished changing "+path.basename(value)+"!");
        }else{
            console.error("Error could not find "+path.basename(value)+"!");
        }
    })

    console.log("Finished changing Files!");
    
    deferral.resolve();

    return deferral.promise;
}