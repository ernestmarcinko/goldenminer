set PATH=%~dp0;"C:\Program Files (x86)\Microsoft\Microsoft Ajax Minifier\"
ajaxmin -term -new:keep -cc:true -reorder:false -literals:noeval -inline:force -fnames:keep -rename:none -clobber  js\nomin\game.js js\nomin\lzma.js js\nomin\planets.js js\nomin\buildings.js js\nomin\minions.js js\nomin\items.js  js\nomin\game.js js\nomin\skills.js js\nomin\utilities.js js\nomin\animations.js js\nomin\output.js js\nomin\events.js  -out js\g.js

pause