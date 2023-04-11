    const args = process.argv

    var localizationStringsJSON;
    for (const arg of args) {  
      if (arg.includes('LOCALIZATION_STRINGS_JSON')){
        var stringArray = arg.split("=");
        localizationStringsJSON = stringArray.slice(-1).pop();
      }
    }