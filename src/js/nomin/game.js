var game = new Object();
(function( $ ){
  var methods = {
  
     init : function( options ) {      
       game = $.extend({},this, methods);
       game.load();   
       return game;
     },
     
     load: function() {
        //load data from cookies
        game.loadSavedGame();
        game.startMining();
        output.load();
        events.load();
        setInterval(function(){
           game.data.totalTime += 1;
           game.potionTimer();
           game.buildingTimer();
           output.loadGamble();
           output.checkButtons();
           output.refreshStats();
        },1000);
        setInterval(function(){
           game.autoSave();
        },30000);  
        animations.startGold();
        animations.startDiamond();
     },
     
     autoSave: function()  {
        var string = JSON.stringify(game.data);
        //console.log("orig: ", string.length);
        string =LZString.compressToBase64(string)
        //console.log("comp: ", string.length)
        localStorage.setItem('gamedata', string);
        animations.popText('Game autosaved');
        return;
     },
     
     
     loadSavedGame : function() {
        game.d = game.getGameFromCookie();
        if (game.d==null || game.d=='' || game.d.planet==null) {
          game.newGame(); 
        } else {
          game.newGame();
          game.data = $.extend(true, game.data, game.d);
        }
     },
     
     getValidatedSaveString: function(str) {
        var s = LZString.decompressFromBase64(str);
        if (s==null) return null;
        try {
          s = JSON.parse(s);    
        } catch(e) {
          return null;
        }
        if (s!=null && s.character!=null)
          return s;
        else
          return null;
     },
     
     getGameFromCookie : function() {
        var c = localStorage.getItem('gamedata');
        if (c==null || c=="") return null;
        return game.getValidatedSaveString(c);
     },
     
     hardReset: function() {
        game.newGame();
        localStorage.setItem('gamedata', '');
        location.reload(); 
     },
     
     
     newGame: function(planet) {
        var data = new Object();
        if ((typeof planet)=='undefined') planet = 0;
        data.planet = planet; 
        data.character = planets[planet].charAttrs;
        data.stats = {
          clicks: 0, //
          totalGold: 0,
          clickGold: 0, //
          minedGold: 0, //
          itemSoldGold: 0,  //
          totalDiamonds: 0,
          clickDiamonds: 0, //
          minedDiamonds: 0, //
          itemsFound: 0,  //
          itemsGambled: 0,  //
          itemsSold: 0,   //
          itemsCrafted: 0,   //
          magicItemsCrafted: 0, //
          rareItemsCrafted: 0,   //
          legendaryItemsCrafted: 0, //
          magicItemsFound: 0,   //
          rareItemsFound: 0,     //
          legendaryItemsFound: 0,  //
          magicItemsGambled: 0,     //
          rareItemsGambled: 0,    //
          legendaryItemsGambled: 0,     //
          scrollsFound: 0,  //
          scrollsGambled: 0,//
          potionsFound: 0,    //
          potionsGambled: 0,    //
          potionsDrinked: 0    //
        };
        data.maxGPSEver = 0;
        data.maxDPSEver = 0;
        data.mineTime =  0;                    
        data.totalTime = 0;
        data.stash = new Array();
        data.finds = new Array();                   
        data.options = {
          enableFancyAnim: 1,
          stopOnInvFull: 1,
          autoSellMagic: 0,
          autoSellRare: 0,
          autoSellMagicScrolls: 0,
          autoSellRareScrolls: 0,
          autoStashLegendary: 0,
          autoStashOthers: 0
        };
        data.buildings = {
          0: {
            funds: 0,
            timer: 0
          },
          1: {
            funds: 0,
            timer: 0
          },
          2: {
            funds: 0,
            timer: 0
          },
          3: {
            funds: 0,
            timer: 0
          },
          4: {
            funds: 0,
            timer: 0
          }   
        };
        data.potions = {
          goldFrenzy: 0,
          diamondFrenzy: 0,
          mfFrenzy: 0
        };
        game.isMining = true;
        game.mineTimer = null;
        game.data = data;
        game.freshFind = false;
        game.runNo = 1;
        game.prevRuntime = new Date().getTime();
        game.fps = 10;
        game.focus = true;
        game.latency = 0;
     },
     
     startMining: function() {
        var curTime = new Date().getTime();
        var latency =  curTime - game.prevRuntime - (1000/game.fps);
        latency = (latency<0)?0:latency;
        game.latency += latency;
        game.data.inMine = true;
        game.doMine();
        if (game.latency>1000) game.latency = 1000;
        while (game.latency>99) {
          game.doMine();
          game.latency -= 100;
        }
        output.loadStats();
        game.prevRuntime = new Date().getTime();
        if (game.isMining)
          game.mineTimer = setTimeout(game.startMining, (1000/game.fps)); 
     },
     
     restartMining: function() {
        if (game.isMining==false) {
          game.isMining = true;
          game.mineTimer = setTimeout(game.startMining, (1000/game.fps));
          animations.startGold();
          animations.startDiamond();
        }
     },
     
     stopMining: function() {
         clearTimeout(game.mineTimer);
         game.isMining = false;
         game.data.inMine = false;
         animations.stopGold();
         animations.stopDiamond();
     },
     
     checkPlanetChange: function() {
         if (game.data.character.level>=54) {
            game.stopMining();
            output.loadTravelButton();
         }   
     },
     
     stashIntegrityCheck: function() {
        for (var i in game.data.stash) {
          if (Object.keys(game.data.stash[i]).length<1)
            game.data.stash.splice(i, 1);
        }
     },
     
     potionTimer: function() {
        if (game.data.potions.goldFrenzy>0) {
          game.data.potions.goldFrenzy -= 1;
        }
        if (game.data.potions.diamondFrenzy>0) {
          game.data.potions.diamondFrenzy -= 1;
        }
        if (game.data.potions.mfFrenzy>0) {
          game.data.potions.mfFrenzy -= 1;
        }
     },
     
     buildingTimer: function() {
        for (var i in game.data.buildings) {
           // return if no funds
           if (game.data.buildings[i].funds==0)
             continue;   
           if (buildings[i].type==1)
             continue;       
           // need a drop
           if (game.data.buildings[i].timer<2) {
             // funds left
              if (game.data.buildings[i].funds>1) {
                game.data.buildings[i].funds--;
                game.data.buildings[i].timer = 1800;
              } else {
                game.data.buildings[i].funds--;
                game.data.buildings[i].timer = 0;
              }
              if (i==0) {
                var type = Math.floor(Math.random()*Math.floor(5));
                var tclass = getRandomInt(1, items.tc[game.data.character.level]);
                var item = items.generateLegendary(type, tclass);
                game.data.stash.push(item);
                output.loadStash();
              } else if (i==1) {
                var item = items.generatePotion();
                game.data.stash.push(item);
                output.loadStash();
                break;
              } else if (i==2) {
                var item = items.generateScroll();
                game.data.stash.push(item);
                output.loadStash();
                break;
              }
           } else {
             game.data.buildings[i].timer--; 
           }
        }
        output.refreshBuildings();
     },
     
     drinkPotion: function(item) {
        if ((typeof item)=="undefined" || item==null) return;
        if (item.duration>0) {
          switch(item.type) {
          case 10:
            game.data.potions.goldFrenzy += item.duration;
            break;
          case 11:
            game.data.potions.diamondFrenzy += item.duration;
            break;
          case 12:
            game.data.potions.mfFrenzy += item.duration;
            break;
          }
        } else {
          switch(item.type) {
          case 8:
            game.data.character.gold *= 1.04;
            break;
          case 9:
            game.data.character.diamonds *= 1.04;
            break;  
          }   
        }
     },
     
     checkOptions: function(wasGamble) {
         if (wasGamble == 1) return;
         if (game.data.finds.length==0) return;
         var lastItem = game.data.finds[game.data.finds.length-1];
         var sold = false;
         
         // Check to stash Legendary
         if (lastItem.quality==3) {
            if (game.data.options.autoStashLegendary == 1) {
              setTimeout(function() {
                var item = $("#finds .item:last-child .stash");
                $(item).click();
              }, 500);            
            }
         }
         
         // Check to sell Magic//Rare scrolls        
         if (game.data.options.autoSellMagicScrolls == 1) {
            if (lastItem.quality == 10 && lastItem.scrollType == 0) {
              sold = true;
              setTimeout(function() {
                 var item = $("#finds .item:last-child .sell");
                 $(item).click(); 
              }, 500);               
            }          
         }
         if (game.data.options.autoSellRareScrolls == 1) {
            if (lastItem.quality == 10 && lastItem.scrollType == 1) {
              sold = true;
              setTimeout(function() {
                 var item = $("#finds .item:last-child .sell");
                 $(item).click(); 
              }, 500);                 
            } 
         }        
         
         // Check to stash Misc
         if (lastItem.quality>3) {
            if (game.data.options.autoStashOthers == 1 && !sold) {
              setTimeout(function() {
                var item = $("#finds .item:last-child .stash");
                $(item).click(); 
              }, 500);             
            }
         }
         
         // Check to sell Magic//Rare items       
         if (game.data.options.autoSellMagic == 1) {
            if (lastItem.quality == 1) {
              
              setTimeout(function() {
                 var item = $("#finds .item:last-child .sell");
                 $(item).click(); 
              }, 500);               
            }          
         }
         if (game.data.options.autoSellRare == 1) {
            if (lastItem.quality == 2) {
              setTimeout(function() {
                 var item = $("#finds .item:last-child .sell");
                 $(item).click(); 
              }, 500);                 
            }          
         }
         
         // Check for full stash
         if (game.data.options.stopOnInvFull==1) {
            if (game.data.stash.length>250) { 
              // Stop the game
              var item = $("#stash .item:last-child .sell");
              $(item).click();
              game.stopMining();
              output.load();
            }
         } else {
            if (game.data.stash.length>250) {
              // Sell the oldest item
              var item = $("#stash .item:last-child .sell");
              $(item).click();
            }
         }         
         
         // Check for full inventory
         if (game.data.options.stopOnInvFull==1) {
            if (game.data.finds.length>250) { 
              // Stop the game
              var item = $("#finds .item:last-child .sell");
              $(item).click();
              game.stopMining();
              output.load();
            }
         } else {
            if (game.data.finds.length>250) {
              // Sell the oldest item
              var item = $("#finds .item:last-child .sell");
              $(item).click();
            }
         }
         /* stopOnInvFull: 1,
          autoSellMagic: 0,
          autoSellRare: 0,
          autoStashLegendary: 0,
          autoStashOthers: 0*/
     },
     
     doMine: function() {
        game.calcStats();
        var plusGold = game.data.character.goldPerSec / 10;
        var plusDiamonds = game.data.character.diamondsPerSec / 10;
        
        game.data.character.gold += plusGold;
        //game.data.character.gold = Math.round(game.data.character.gold);
        game.data.character.diamonds += plusDiamonds;
        //game.data.character.diamonds = Math.round(game.data.character.diamonds);
        
        game.data.stats.minedGold += plusGold;
        game.data.stats.minedDiamonds += plusDiamonds;
        
        // && game.data!=null for the minifier!!
        if (game.runNo > 9 && game.data!=null) {
          if (game.data==null) return false;
          game.runNo = 0;
          game.gainXp();
          game.dropItem(-1);
        }
        game.runNo++;
     },
     
     gainXp: function() {
        game.data.character.nextLvlXp = 
           (charlvl.initialXpToNext * Math.pow(charlvl.xpModifier, (game.data.character.level -1))) + charlvl.initialXpToNext;
        game.data.character.xp += game.getXpPerSec();
          //(game.data.character.maxXpPerSec/100) * charlvl.initialXpPerSec * Math.pow(charlvl.xpPerSecModifier, (game.data.character.level -1));
        if (game.data.character.xp >= game.data.character.nextLvlXp) {
           game.data.character.xp -= game.data.character.nextLvlXp;
           game.data.character.level++;
           game.data.character.skill += charlvl.skillPerLvl;
        } 
        game.checkPlanetChange();
     },
     
     getXpPerSec: function() {
        var extraInitialXp = game.data.buildings[3].funds + game.data.buildings[4].funds;
        return (extraInitialXp * (1 + game.data.character.maxXpPerSec/100)) + ((1 + game.data.character.maxXpPerSec/100) * charlvl.initialXpPerSec * Math.pow(charlvl.xpPerSecModifier, (game.data.character.level -1)));
     },
    
     getGambleCost: function() {
         /*return {
          0: Math.pow(gamble.levelModifier, Math.floor(game.data.character.level/1) - 1) * gamble.price + gamble.price + game.data.character.goldPerSec * 8,
          1: Math.pow(gamble.dlevelModifier, Math.floor(game.data.character.level/1) - 1) * gamble.dprice + gamble.dprice + game.data.character.diamondsPerSec * 4
         }*/
         return {
          0: Math.pow(gamble.levelModifier, Math.floor(game.data.character.level/1) - 1) * gamble.price + gamble.price + game.data.character.goldPerSec * 50,
          1: Math.pow(gamble.dlevelModifier, Math.floor(game.data.character.level/1) - 1) * gamble.dprice + gamble.dprice + game.data.character.diamondsPerSec * 70
         }
     },
     
     getBuildingPrice: function(i) {
        if (buildings[i].type==0) {
          if (buildings[i].currency==0)
            return (buildings[i].priceModifier * game.data.maxGPSEver * 1800);
          else
            return (buildings[i].priceModifier * game.data.maxDPSEver * 2400);
        } else {
          return buildings[i].price;
        }
     },
     
     getStatsIfEquipped: function(place, id) {        
        var item = game.data[place][id];
        if (item.quality>3) return null;
        var oldItem = null;
        if ((typeof game.data.character.equipment[item.type])!='undefined')
          oldItem = game.data.character.equipment[item.type];
        var oldResult = {
          'goldPerSec': game.data.character.goldPerSec,
          'diamondsPerSec': game.data.character.diamondsPerSec,
          'magicFind': game.data.character.magicFind,
          'maxXpPerSec': game.getXpPerSec()        
        }
        game.equip(item.type, item);
        game.calcStats();
        var result = {
          'goldPerSec': game.data.character.goldPerSec-oldResult['goldPerSec'],
          'diamondsPerSec': game.data.character.diamondsPerSec-oldResult['diamondsPerSec'],
          'magicFind': game.data.character.magicFind-oldResult['magicFind'],
          'maxXpPerSec': game.getXpPerSec()-oldResult['maxXpPerSec']         
        };
        game.equip(item.type, oldItem);
        game.calcStats();
        return result;
     },
     
     equip: function(type, item) {
        game.data.character.equipment[type] = item;
     }, 
     
     getMinionPrice: function(id) {
        var owned = 0;
        if (game.data.character.minions[id]!=null)
          owned = game.data.character.minions[id]; 
        var cost = minions[id].price * Math.pow(minions[id].priceModifier, owned);
        return cost-(cost * (game.data.character.trainer * skills['trainer'].value/100));
     },
          
     calcStats: function() {
        //reset dynamic stats
        game.data.character['goldPerSec'] = game.data.character['initialGoldPerSec'];
        game.data.character['diamondsPerSec'] = game.data.character['initialDiamondsPerSec'];
        game.data.character['magicFind'] = game.data.character['initialMagicFind'];
        game.data.character['clickEfficiency'] = game.data.character['initialClickEfficiency'];
        game.data.character['maxGPS'] = game.data.character['initialMaxGPS'];
        game.data.character['maxDPS'] = game.data.character['initialMaxDPS'];
        game.data.character['maxXpPerSec'] = game.data.character['initialMaxXpPerSec'];
        game.data.character.allSkills = game.data.character.initial_allSkills;
        
        // add up the initial skill bonuses
        
        game.data.character.goldenAxe = game.data.character.initial_goldenAxe;
        game.data.character.jeweler = game.data.character.initial_jeweler;
        game.data.character.blacksmith = game.data.character.initial_blacksmith;
        game.data.character.trainer = game.data.character.initial_trainer;

        // add up the item bonuses
        for(var j in game.data.character.equipment) {
            var item = game.data.character.equipment[j];
            if (item==null || item.attributes==null) continue;
            for(var i in item.attributes) {
                game.data.character[i] +=  item.attributes[i];
            }
        }
        
        game.data.character.goldenAxe += game.data.character.allSkills;
        game.data.character.jeweler += game.data.character.allSkills;
        game.data.character.blacksmith += game.data.character.allSkills;
        game.data.character.trainer += game.data.character.allSkills;
        
        // add up the minion bonuses
        for (var i in game.data.character.minions) {
            for(var j in minions[i].attributes) {
                game.data.character[j] += 
                  minions[i].attributes[j] * game.data.character.minions[i];
            }
        }                                                     
        
        game.data.character['goldPerSec'] *= (1 + game.data.character.goldenAxe/100);
        game.data.character['diamondsPerSec'] *= (1 + game.data.character.jeweler/100);
        
        game.data.character['goldPerSec'] *= (1 + game.data.character['maxGPS']/100); 
        game.data.character['diamondsPerSec'] *= (1 + game.data.character['maxDPS']/100);
  
        if (game.data.character.goldPerSec>game.data.maxGPSEver) {
           game.data.maxGPSEver = game.data.character.goldPerSec;
        }
        if (game.data.character.diamondsPerSec>game.data.maxDPSEver) {
           game.data.maxDPSEver = game.data.character.diamondsPerSec;
        }
        
        if (game.data.potions.goldFrenzy>0)
          game.data.character['goldPerSec'] *= 8;
        if (game.data.potions.diamondFrenzy>0)
          game.data.character['diamondsPerSec'] *= 8;
        if (game.data.potions.mfFrenzy>0)
          game.data.character['magicFind'] += 15;           
     },
     
     dropItem: function(itype, gambled) {
        if ((typeof gambled)=='undefined') gambled = false;
        var mf = game.data.character.magicFind * 100; 
        var rnd =  getRandomInt(1, 10000);        
        if (rnd<=mf || itype>-1) {
           //Item drop!
           game.data.finds.push(game.generateItem(itype, gambled));
           if (itype>-1) {
              game.data.stats.itemsGambled++;
              output.loadGambled();
           } else {  
              game.data.stats.itemsFound++;
              output.loadFind();
              game.checkOptions(0)
           }
        }  
     },
     
     craftItem: function(itype) {
        var item = null;
        var tclass = items.tc[game.data.character.level] + 1;
        var type = Math.floor(Math.random()*Math.floor(5));
        game.data.stats.itemsCrafted++;
        switch(itype) {
        case 5:
          item = items.generateMagic(type, tclass, true);
          game.data.stats.magicItemsCrafted++;
          break;
        case 6:
          item = items.generateRare(type, tclass, true);
          game.data.stats.rareItemsCrafted++;
          break;
        case 7:
          item = items.generateLegendary(type, tclass, true);
          game.data.stats.legendaryItemsCrafted++;
          break;
        case 13:
          var remainingSkills = (game.data.character.level-1)*charlvl.skillPerLvl + 1;
          game.data.character.skill = remainingSkills;
          game.data.character.initial_goldenAxe = 0;
          game.data.character.initial_jeweler = 0;
          game.data.character.initial_trainer = 0;
          game.data.character.initial_blacksmith = 0;
          break;
        }
        if (itype!=13) {
          game.data.stash.prepend(item);
          output.loadStash();
          animations.pulse($('#stash .item:first-child'));
        } else {
          game.calcStats();
          output.loadSkills();
        }
     },
     
     insertGem: function(stashId, eqId) {
         var eq = game.data.character.equipment;
         var item = game.data.stash[stashId];
         if (eq[eqId]==null || item==null || eq[eqId].openSockets==null || eq[eqId].openSockets<1) return;
          var r=confirm("Do you want to insert this gem into that item?");
          if (r==false)
          return;
         if (eq[eqId]['attributes'][items.gems[item.gemType][item.gemSize]['attribute']]==null)
          eq[eqId]['attributes'][items.gems[item.gemType][item.gemSize]['attribute']] = items.gems[item.gemType][item.gemSize]['value'];
         else
          eq[eqId]['attributes'][items.gems[item.gemType][item.gemSize]['attribute']] += items.gems[item.gemType][item.gemSize]['value'];
         eq[eqId].openSockets--;
         eq[eqId].socketedWith.push(item.type);
         game.data.stash.splice(stashId, 1);
         game.calcStats();
         output.loadCharacter();
         output.loadSkills();
         output.loadStats();
         output.loadStash();
     },
     
     generateItem: function(itype, gambled) {
        if ((typeof gambled)=='undefined') gambled = false;
        var quality =  Math.floor((Math.random()*Math.floor(1000))+1);
        if (itype!=-1)
          var type = itype;
        else
          var type = Math.floor(Math.random()*Math.floor(5));
        var tclass = getRandomInt(1, items.tc[game.data.character.level]);
        if (quality<=90) {
           //gem
           var newItem = items.generateGem();
           if (gambled)
              game.data.stats.magicItemsGambled++;
           else
              game.data.stats.magicItemsFound++;
        } else if (quality<=750) {
           //magic
           var newItem = items.generateMagic(type, tclass, false);
           if (gambled)
              game.data.stats.magicItemsGambled++;
           else
              game.data.stats.magicItemsFound++;
        } else if (quality<=910) {
           //rare
           var newItem = items.generateRare(type, tclass, false);
           if (gambled)
              game.data.stats.rareItemsGambled++;
           else
              game.data.stats.rareItemsFound++;
        } else if (quality<=940) {
           //legendary
           var newItem = items.generateLegendary(type, tclass);
           if (gambled)
              game.data.stats.legendaryItemsGambled++;
           else
              game.data.stats.legendaryItemsFound++;
        } else if (quality<=970) {
          //scroll
           var newItem = items.generateScroll(type, tclass);
           if (gambled)
              game.data.stats.scrollsGambled++;
           else
              game.data.stats.scrollsFound++;
        } else {
          //potion
           var newItem = items.generatePotion(type, tclass);
           if (gambled)
              game.data.stats.potionsGambled++;
           else
              game.data.stats.potionsFound++;        
        }
        return newItem;
     }
  };

  $.fn.goldenminer = function( method ) {
    if ( methods[method] ) {
      return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
    } else if ( typeof method === 'object' || ! method ) {
      return methods.init.apply( this, arguments );
    } else {
      $.error( 'Method ' +  method + ' does not exist on jQuery.goldenminer' );
    }    
  
  };
	function is_touch_device(){
		return !!("ontouchstart" in window) ? 1 : 0;
	}
})( jQuery );


