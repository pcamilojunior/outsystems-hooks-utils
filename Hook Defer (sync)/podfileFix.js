var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

module.exports = function(context) {

    const projectRoot = context.opts.projectRoot;
    const podfilePath = path.join(projectRoot, 'platforms', 'ios', 'Podfile');
    const target = 'CocoaLumberjack';

    var deferral = require('q').defer();
 
    fs.readFile(podfilePath, {encoding: 'utf-8'}, function(err, data) {

        if (err) throw error;

        //Clean Pods
        var pathiOS = path.join(context.opts.projectRoot,"platforms","ios");
        var child = child_process.execSync('rm -rf Pods;rm -rf Podfile.lock;pod cache clean --all', {cwd:pathiOS});
        console.log("⭐️ Pod Cleaning: Process finished ⭐️");
        if(child.error) {
            console.log("🚨 ERROR cleaning pods: ",child.error);
            deferral.reject('ERROR cleaning pods: ' + child.error);
        }

        let dataArray = data.split('\n');

        for (let index=0; index<dataArray.length; index++) {
            if (dataArray[index].includes(target)) {
                dataArray.splice(index, 1);
                break; 
            }
        }

        const updatedData = dataArray.join('\n');

        fs.writeFile(podfilePath, updatedData, (err) => {
            if (err) throw err;
            console.log ('⭐️ Podfile Successfully updated ⭐️');

            //Run "pod deintegrate" & "pod install"
            var pathiOS = path.join(context.opts.projectRoot,"platforms","ios");
            var child = child_process.execSync('pod deintegrate;pod install', {cwd:pathiOS});
            console.log("⭐️ Pod Deintegrate & Install: Process finished ⭐️");
            if(child.error) {
                console.log("🚨 ERROR: ",child.error);
                deferral.reject("ERROR: " + child.error);
            }
        });
        deferral.resolve();
    });
    return deferral.promise;
}
