    const args = process.argv

    var localizationStringsJSON;
    for (const arg of args) {  
      if (arg.includes('LOCALIZATION_STRINGS_JSON')){
        var stringArray = arg.split("=");
        localizationStringsJSON = stringArray.slice(-1).pop();
      }
    }

    //localizationStringsJSON = '{"languages":["pt","it","en"],"translations":{"pt":{"camera":"Precisamos aceder a tua câmera!", "location":"Precisamos da tua localização!"}, "it":{"camera":"Dobbiamo accedere alla tua fotocamera!", "location":"Dobbiamo accedere alla tua posizione!"}, "en":{"camera":"We need to access your camera!", "location":"We need to access your position!"}}}';

    //JSON parsing
    const localizations = JSON.parse(localizationStringsJSON);

    //Create root translations directory
    var translationsDir = path.join(context.opts.projectRoot, 'translations', 'app');

    if (!fs.existsSync(translationsDir)){
        fs.mkdirSync(translationsDir, { recursive: true });
    }

    //Read Json template
    var jsonTemplatePath = path.join(context.opts.projectRoot, 'plugins/cordova-plugin-localization-strings/scripts/language_template.json');

    let fileContents;
    try {
        fileContents = fs.readFileSync(jsonTemplatePath).toString();

        //Checks required languages array and create respective files
        for (let i = 0; i < localizations.languages.length; i++) {
          let translationFilePath = path.join(translationsDir, localizations.languages[i] + ".json");
          let translation = localizations.translations[localizations.languages[i]];

          var jsonToBeSaved = fileContents.replace(/CAMERA_MESSAGE_PLACEHOLDER/g, translation.camera);
          jsonToBeSaved = jsonToBeSaved.replace(/LOCATION_MESSAGE_PLACEHOLDER/g, translation.location);

          fs.writeFileSync(translationFilePath, jsonToBeSaved, function(err) {
            if(err) {
                return console.log("🚨 Error writing translation file " + localizations.languages[i] + ".json: " + err);
            }
            console.log("✅ The translation file for " + localizations.languages[i] + " was saved!");
          }); 
        }

    } catch (err) {
        console.log("🚨 Error: " + err);
        throw err;
    }