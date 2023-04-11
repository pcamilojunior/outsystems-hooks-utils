const path = require('path');
var child_process = require('child_process');

module.exports = function (ctx) {
    var pathiOS = path.join(ctx.opts.projectRoot,"platforms","ios");
    
    var child = child_process.execSync('pod install', {cwd:pathiOS});
    console.log("Pod Install: Process finished.");
    if(child.error) {
        console.log("ERROR: ",child.error);
    }
}