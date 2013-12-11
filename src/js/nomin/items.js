var gamble = new Object();

gamble = {
  price: 1000,
  dprice: 300,
  levelModifier: 1.40,
  dlevelModifier: 1.35
};

var items = new Object();

/* Methods */
items.generateMagic = function(itype, tclass, fixedTclass) {
    var type = itype;
    if (!fixedTclass)
      tclass = getRandomInt(1, items.tc[game.data.character.level]);
    if (items.suffixes[tclass]==null || items.suffixes[tclass]==null)
      tclass -= 1;
    var pre = items.prefixes[tclass][Math.floor(Math.random()*Object.keys(items.prefixes[tclass]).length)];
    if (!fixedTclass)
      tclass = getRandomInt(1, items.tc[game.data.character.level]);
    if (items.suffixes[tclass]==null || items.suffixes[tclass]==null)
      tclass -= 1;
    var suf = items.suffixes[tclass][Math.floor(Math.random()*Object.keys(items.suffixes[tclass]).length)];
    var sockets = getRandomInt(1, 3);
    var newItem = {
      name: pre.name + " " + items.types[type] + " of " + suf.name,
      price: items.prices[type] * Math.pow(items.priceModifier, (game.data.character.level-1) ),
      'type': type,
      'quality': 1,
      'sockets': sockets,
      'openSockets': sockets,
      'socketedWith': [],
      attributes: new Object()
    }; 
    if ((typeof items.attributes[pre.attr].isInt)!='undefined' && items.attributes[pre.attr].isInt!=null && items.attributes[pre.attr].isInt!=false) {
      newItem["attributes"][pre.attr] = getRandomInt(pre.min, pre.max);        
    } else {
      newItem["attributes"][pre.attr] = getRandom(pre.min, pre.max) * (1 + game.data.character.blacksmith/100);    
    }
    if ((typeof items.attributes[suf.attr].isInt)!='undefined' && items.attributes[suf.attr].isInt!=null && items.attributes[suf.attr].isInt!=false) {
      newItem["attributes"][suf.attr] = getRandomInt(suf.min, suf.max);        
    } else {
      newItem["attributes"][suf.attr] = getRandom(suf.min, suf.max) * (1 + game.data.character.blacksmith/100);    
    }
       
    return newItem;
};

items.generateRare = function(itype, tclass, fixedTclass) {
    var type = itype;
    if (!fixedTclass)
      tclass = getRandomInt(1, items.tc[game.data.character.level]);
    if (items.suffixes[tclass]==null || items.suffixes[tclass]==null)
      tclass -= 1;
    var pre = items.prefixes[tclass][Math.floor(Math.random()*Object.keys(items.prefixes[tclass]).length)];
    if (!fixedTclass)
      tclass = getRandomInt(1, items.tc[game.data.character.level]);
    if (items.suffixes[tclass]==null || items.suffixes[tclass]==null)
      tclass -= 1;
    var suf = items.suffixes[tclass][Math.floor(Math.random()*Object.keys(items.suffixes[tclass]).length)];
    
    var sockets = getRandomInt(1, 3);
    var newItem = {
      name: pre.name + " " + suf.name,
      price: items.prices[type] * Math.pow(items.priceModifier, (game.data.character.level-1) ) * 1.5,
      'type': type,
      'quality': 2,
      'sockets': sockets,
      'openSockets': sockets,
      'socketedWith': [],
      attributes: new Object()
    };
    if ((typeof items.attributes[pre.attr].isInt)!='undefined' && items.attributes[pre.attr].isInt!=null && items.attributes[pre.attr].isInt!=false ) {
      newItem["attributes"][pre.attr] = getRandomInt(pre.min, pre.max);          
    } else {
      newItem["attributes"][pre.attr] = getRandom(pre.min, pre.max)* 1.5 * (1 + game.data.character.blacksmith/100);          
    } 
    if ((typeof items.attributes[suf.attr].isInt)!='undefined' && items.attributes[suf.attr].isInt!=null && items.attributes[suf.attr].isInt!=false ) {
      newItem["attributes"][suf.attr] = getRandomInt(suf.min, suf.max);       
    } else {
      newItem["attributes"][suf.attr] = getRandom(suf.min, suf.max)* 1.5 * (1 + game.data.character.blacksmith/100);    
    }
    return newItem;
};

items.generateLegendary = function(itype, tclass) {
    var type = itype;
    if (items.legendary[type][tclass]==null) {
      tclass -= 1;    
    } else {
      var chance = getRandomInt(1, 10);
      if (chance<8) {
        tclass -= 1;
      }
    }
    if (tclass<1) tclass = 1;
    var item = 
      $.extend(true, {}, items.legendary[type][tclass][Math.floor(Math.random()*Object.keys(items.legendary[type][tclass]).length)]);
    var sockets = getRandomInt(1, 3);
    var newItem = {
      name: item.name,
      price: items.prices[type] * Math.pow(items.priceModifier, (game.data.character.level-1) ) * 3,
      'type': type,
      'quality': 3,
      'sockets': sockets,
      'openSockets': sockets,
      'socketedWith': [],
      attributes: item.attributes
    }; 
    for(var i in newItem["attributes"]) {
      if ((typeof items.attributes[i].isInt)!='undefined' && items.attributes[i].isInt!=null && items.attributes[i].isInt!=false )
        newItem["attributes"][i] *=  1;
      else
        newItem["attributes"][i] *=  getRandom(1, item.variability) * (1 + game.data.character.blacksmith/100);
    }
    return newItem;
};
items.generateScroll = function() {
    var scrollType = getRandomInt(1, 1000);
    var type = 0;
    if (scrollType<600) {
       type = 5;
       scrollType = 0;
    } else if(scrollType<910) {
       type = 6;
       scrollType = 1; 
    } else if(scrollType<990) {
       type = 7;
       scrollType = 2;
    } else {
       type = 13;
       scrollType = 3;
    }
    var newItem = {
      'name': items.scrolls[scrollType].name,
      'price': items.prices[type],
      'type': type,
      'scrollType': scrollType,
      'quality': 10,
      'diamondsCost': items.scrolls[scrollType].diamondCost * Math.pow(items.diamondPriceModifier, (game.data.character.level-1) ),
      attributes: {}
    };
    return newItem;
};

items.generatePotion = function() {
    var potionType = getRandomInt(1, 100);
    var type = 0;
    if (potionType<20) {
       type = 8;
       potionType = 0;
    } else if(potionType<40) {
       type = 9;
       potionType = 1;
    } else if(potionType<60) {   
       type = 10;
       potionType = 2;       
    } else if(potionType<80) {   
       type = 11;
       potionType = 3;       
    } else {
       type = 12;
       potionType = 4;
    }
    var newItem = {
      'name': items.potions[potionType].name,
      'price': items.prices[type],
      'type': type,
      'potionType': potionType,
      'quality': 20,
      'duration': items.potions[potionType].duration,
      attributes: {}
    };
    return newItem;
};

items.generateGem = function() {
    var gemType = getRandomInt(0, 4);
    var gemSize = 0;
    tclass = getRandomInt(1, items.tc[game.data.character.level]);
    
    // Determine gem size from treasure class
    if (tclass<3)
      gemSize = 0;
    else if (tclass<6)
      gemSize = 1;
    else if (tclass<10)
      gemSize = 2;
    else
      gemSize = 3;
      
    // Random gem type
    var type = 100 + (10*gemType) + gemSize;
    /*if (gemType<=2) {
       type = 100 + gemSize;
       gemType = 0;
    } else if (gemType<=2) {
       type = 110 + gemSize;
       gemType = 1;
    } else if (gemType<=4) {
       type = 120 + gemSize;
       gemType = 2;
    } else if (gemType<=6) {
       type = 130 + gemSize;
       gemType = 3;
    } else if (gemType<=8) {
       type = 140 + gemSize;
       gemType = 4;
    } */
    
    var newItem = {
      'name': items.gems[gemType][gemSize].name,
      'price': items.prices[type], 
      'type': type,
      'gemType': gemType,
      'gemSize': gemSize,
      'quality': 20,
      attributes: {}
    };
    return newItem;
};


/* DATA */
items.tc = {
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 
  12:2, 13: 2, 14:2, 15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 20: 2,
  21: 3, 22: 3, 23: 3, 24: 3, 25: 3, 26: 3,
  27: 4, 28: 4, 29: 4, 30: 4, 31: 4,
  32: 5, 33: 5, 34: 5, 35: 5,
  36: 6, 37: 6, 38: 6, 39: 6,
  40: 7, 41: 7, 42: 7, 43: 7,
  44: 8, 45: 8, 46: 8,
  47: 9, 48: 9, 49: 9,
  50: 10, 51: 10, 
  52: 11, 53: 11,
  54: 12, 55: 12, 56: 12, 57: 12, 58: 12, 59: 12
};                                          

items.general = {                                   
  goldPerSec: 0,
  diamondsPerSec: 0
};

items.types = {
  0: 'pickaxe',
  1: 'armor',
  2: 'helm',
  3: 'ring',
  4: 'amulet',
  5: 'Blue scroll',
  6: 'Yellow scroll',
  7: 'Legendary scroll',
  8: 'Instant Gold Potion',
  9: 'Instant Diamond Potion',
  10: 'Gold potion',
  11: 'Diamond potion',
  12: 'Lucky potion',
  13: 'Amnesia Scroll',
  100: 'Tiny Ruby',
  101: 'Small Ruby',
  102: 'Big Ruby',
  103: 'Giant Ruby',
  110: 'Tiny Diamond',
  111: 'Small Diamond',
  112: 'Big Diamond',
  113: 'Giant Diamond',
  120: 'Tiny Amethyst',
  121: 'Small Amethyst',
  122: 'Big Amethyst',
  123: 'Giant Amethyst',
  130: 'Tiny Sapphire',
  131: 'Small Sapphire',
  132: 'Big Sapphire',
  133: 'Giant Sapphire',
  140: 'Tiny Starstone',
  141: 'Small Starstone',
  142: 'Big Starstone',
  143: 'Giant Starstone'
};

items.priceModifier = 1.2;
items.diamondPriceModifier = 1.3;

items.prices = {
  // eq
  0: 15,
  1: 10,
  2: 9,
  3: 20,
  4: 17,
  // scrolls
  5: 200,
  6: 500,
  7: 1000,
  // potions
  8: 500,
  9: 500,
  10: 500,
  11: 500,
  12: 500,
  13: 1000,
  // Gems
  100: 1000,
  101: 1000,
  102: 1000,
  103: 1000,
  110: 1000,
  111: 1000,
  112: 1000,
  113: 1000,
  120: 1000,
  121: 1000,
  122: 1000,
  123: 1000,
  130: 1000,
  131: 1000,
  132: 1000,
  133: 1000,
  140: 1000,
  141: 1000,
  142: 1000,
  143: 1000
};

items.attributes = {
  'goldPerSec': {
    name: 'gold per second',
    fixed: 2    
  },
  'diamondsPerSec': {
    name: 'diamonds per second',
    fixed: 2    
  },           
  'magicFind': {
    name: 'magic find',
    fixed: 2
  },           
  'maxGPS': {
    name: '% gold per second',
    fixed: 1
  },
  'maxDPS': {
    name: '% diamonds per second',
    fixed: 1
  },
  'maxXpPerSec': {
    name: '% experience gained',
    fixed: 1
  },
  'goldenAxe': {
    name: 'to The Golden Axe',
    fixed: 0,
    isInt: true
  },
  'blacksmith': {
    name: 'to The Blacksmith',
    fixed: 0,
    isInt: true
  },
  'jeweler': {
    name: 'to The Jeweler',
    fixed: 0,
    isInt: true
  },
  'trainer': {
    name: 'to The Trainer',
    fixed: 0,
    isInt: true
  },
  'allSkills': {
    name: 'to all skills',
    fixed: 0,
    isInt: true
  },
  'sockets': {
    name: 'sockets',
    fixed: 0,
    isInt: true
  },
  'openSockets': {
    name: 'sockets available',
    fixed: 0,
    isInt: true
  }
};


items.scrolls = {
  0: {
    'name': 'Blue scroll',
    description: "The blue scroll crafts into a random magic item from a higher level.",
    diamondCost: 250
  },
  1: {
    'name': 'Yellow scroll',
    description: "The yellow scroll crafts into a random rare item from a higher level.",
    diamondCost: 900
  },
  2: {
    'name': 'Legendary scroll',
    description: "The legendary scroll crafts into a random legendary item from a higher level.",
    diamondCost: 3000
  },
  3: {
    'name': 'Amnesia scroll',
    description: "This scroll will reset all your skill points.",
    diamondCost: 20000
  }
};


items.potions = {
  0: {
    'name': 'Instant Gold Potion',
    description: "Adds +4% of your current gold instantly.",
    duration: 0
  },
  1: {
    'name': 'Instant Diamond Potion',
    description: "Adds +4% of your current diamonds instantly.",
    duration: 0
  },
  2: {
    'name': 'Gold potion',
    description: "Increases your gold/s rate by 800% for 60 seconds.",
    duration: 60
  },
  3: {
    'name': 'Diamond potion',
    description: "Increases your diamonds/s rate by 800% for 60 seconds.",
    duration: 60
  },
  4: {
    'name': 'Lucky potion',
    description: "Increases your magic find rate by 15% for 60 seconds.",
    duration: 60
  }
};

items.gems = {
  /*
  
    Structure:     
    {
      type1: {
        size1 {..},
        size2 {..},
        ...
      },
      ...
    }
    
  */    
  0: {
    0: {
      'name': 'Tiny Ruby',
      description: 'Adds +0.5% gold/s to a socketed item',
      attribute: 'maxGPS',
      value: 0.5
    },
    1: {
      'name': 'Small Ruby',
      description: 'Adds +1% gold/s to a socketed item',
      attribute: 'maxGPS',
      value: 1
    },
    2: {
      'name': 'Big Ruby',
      description: 'Adds +2% gold/s to a socketed item',
      attribute: 'maxGPS',
      value: 2
    },
    3: {
      'name': 'Giant Ruby',
      description: 'Adds +3% gold/s to a socketed item',
      attribute: 'maxGPS',
      value: 3
    }
  },
  1: {
    0: {
      'name': 'Tiny Diamond',
      description: 'Adds +1% diamonds/s to a socketed item',
      attribute: 'maxDPS',
      value: 1
    },
    1: {
      'name': 'Small Diamond',
      description: 'Adds +2% diamonds/s to a socketed item',
      attribute: 'maxDPS',
      value: 2
    },
    2: {
      'name': 'Big Diamond',
      description: 'Adds +4% diamonds/s to a socketed item',
      attribute: 'maxDPS',
      value: 4
    },
    3: {
      'name': 'Giant Diamond',
      description: 'Adds +7% diamonds/s to a socketed item',
      attribute: 'maxDPS',
      value: 7
    }
  },
  2: {
    0: {
      'name': 'Tiny Amethyst',
      description: 'Adds +0.2% magic find/s to a socketed item',
      attribute: 'magicFind',
      value: 0.2
    },
    1: {
      'name': 'Small Amethyst',
      description: 'Adds +0.4% magic find/s to a socketed item',
      attribute: 'magicFind',
      value: 0.4
    },
    2: {
      'name': 'Big Amethyst',
      description: 'Adds +0.7% magic find/s to a socketed item',
      attribute: 'magicFind',
      value: 0.7
    },
    3: {
      'name': 'Giant Amethyst',
      description: 'Adds +1% magic find/s to a socketed item',
      attribute: 'magicFind',
      value: 1
    }
  },
  3: {
    0: {
      'name': 'Tiny Sapphire',
      description: 'Adds +1% experience/s to a socketed item',
      attribute: 'maxXpPerSec',
      value: 1
    },
    1: {
      'name': 'Small Sapphire',
      description: 'Adds +2% experience/s to a socketed item',
      attribute: 'maxXpPerSec',
      value: 2
    },
    2: {
      'name': 'Big Sapphire',
      description: 'Adds +4% experience/s to a socketed item',
      attribute: 'maxXpPerSec',
      value: 4
    },
    3: {
      'name': 'Giant Sapphire',
      description: 'Adds +7% experience/s to a socketed item',
      attribute: 'maxXpPerSec',
      value: 7
    }
  },
  4: {
    0: {
      'name': 'Tiny Starstone',
      description: 'Adds +1 to all skill levels to a socketed item',
      attribute: 'allSkills',
      value: 1
    },
    1: {
      'name': 'Small Starstone',
      description: 'Adds +2 to all skill levels to a socketed item',
      attribute: 'allSkills',
      value: 2
    },
    2: {
      'name': 'Big Starstone',
      description: 'Adds +3 to all skill levels to a socketed item',
      attribute: 'allSkills',
      value: 3
    },
    3: {
      'name': 'Giant Starstone',
      description: 'Adds +4 to all skill levels to a socketed item',
      attribute: 'allSkills',
      value: 4
    }
  }
};


items.prefixes = {
  1: {
    0: {
      name: 'Crappy',
      attr: 'goldPerSec',
      min: 1,
      max: 5
    },
    1: {
      name: 'Shitty',
      attr: 'goldPerSec',
      min: 5,
      max: 7
    },
    2: {
      name: 'Damaged',
      attr: 'goldPerSec',
      min: 8,
      max: 12
    },
    3: {
      name: 'Bad',
      attr: 'goldPerSec',
      min: 13,
      max: 16
    }
  },
  2: {
    0: {
      name: 'Cracked',
      attr: 'goldPerSec',
      min: 16,
      max: 19
    },
    1: {
      name: 'Dusty',
      attr: 'goldPerSec',
      min: 20,
      max: 23
    },
    2: {
      name: 'Taped',
      attr: 'goldPerSec',
      min: 22,
      max: 24
    },
    3: {
      name: 'Runty',
      attr: 'goldPerSec',
      min: 26,
      max: 29
    },
    4: {
      name: 'Poor',
      attr: 'maxGPS',
      min: 0.5,
      max: 1
    }
  },
  3: {
    0: {
      name: 'Poor',
      attr: 'goldPerSec',
      min: 47,
      max: 80
    },
    1: {
      name: 'Hobos',
      attr: 'goldPerSec',
      min: 85,
      max: 130
    },
    2: {
      name: 'Miners',
      attr: 'goldPerSec',
      min: 140,
      max: 180
    },
    3: {
      name: 'Better',
      attr: 'maxGPS',
      min: 1,
      max: 2
    }
  },
  4: {
    0: {
      name: 'Acceptable',
      attr: 'goldPerSec',
      min: 200,
      max: 230
    },
    1: {
      name: 'Robotic',
      attr: 'goldPerSec',
      min: 240,
      max: 300
    },
    2: {
      name: 'Shiny',
      attr: 'goldPerSec',
      min: 310,
      max: 380
    },
    3: {
      name: 'Repaired',
      attr: 'maxGPS',
      min: 2,
      max: 3
    }
  },
  5: {
    0: {
      name: 'Better',
      attr: 'goldPerSec',
      min: 600,
      max: 850
    },
    1: {
      name: 'Chromatic',
      attr: 'goldPerSec',
      min: 900,
      max: 1400
    },
    2: {
      name: 'Golden',
      attr: 'goldPerSec',
      min: 1500,
      max: 2000
    },
    3: {
      name: 'Repaired',
      attr: 'maxGPS',
      min: 3,
      max: 4
    }
  },
  6: {
    0: {
      name: 'Crafted',
      attr: 'goldPerSec',
      min: 1900,
      max: 4000
    },
    1: {
      name: 'Beautiful',
      attr: 'goldPerSec',
      min: 5200,
      max: 9500
    },
    2: {
      name: 'Flawless',
      attr: 'goldPerSec',
      min: 10000,
      max: 17200
    },
    3: {
      name: 'Precious',
      attr: 'maxGPS',
      min: 4,
      max: 5
    }
  },
  7: {
    0: {
      name: 'Dwarfs',
      attr: 'goldPerSec',
      min: 20000,
      max: 30000
    },
    1: {
      name: 'Round',
      attr: 'goldPerSec',
      min: 40000,
      max: 50000
    },
    2: {
      name: 'Completed',
      attr: 'goldPerSec',
      min: 60000,
      max: 80000
    },
    3: {
      name: 'Tremendous',
      attr: 'maxGPS',
      min: 5,
      max: 5.5
    }
  },
  8: {
    0: {
      name: 'Great',
      attr: 'goldPerSec',
      min: 150000,
      max: 200000
    },
    1: {
      name: 'Majestic',
      attr: 'goldPerSec',
      min: 250000,
      max: 350000
    },
    2: {
      name: 'Opal',
      attr: 'goldPerSec',
      min: 400000,
      max: 600000
    },
    3: {
      name: 'Royal',
      attr: 'maxGPS',
      min: 6,
      max: 7
    }
  },
  9: {
    0: {
      name: 'Poetic',
      attr: 'goldPerSec',
      min: 900000,
      max: 1200000
    },
    1: {
      name: 'Legendary',
      attr: 'goldPerSec',
      min: 1300000,
      max: 1800000
    },
    2: {
      name: 'Draculs',
      attr: 'goldPerSec',
      min: 1900000,
      max: 2300000
    },
    3: {
      name: 'Infinite',
      attr: 'maxGPS',
      min: 7,
      max: 8
    }
  },
  10: {
    0: {
      name: 'Artisans',
      attr: 'goldPerSec',
      min: 2800000,
      max: 4000000
    },
    1: {
      name: 'Frantic',
      attr: 'goldPerSec',
      min: 4200000,
      max: 6000000
    },
    2: {
      name: 'Vast',
      attr: 'goldPerSec',
      min: 6200000,
      max: 8000000
    },
    3: {
      name: 'Titanic',
      attr: 'maxGPS',
      min: 8,
      max: 9
    }
  }      
};

items.suffixes = {
  1: {
    0: {
      name: 'waste',
      attr: 'magicFind',
      min: 0.01,
      max: 0.02
    },
    1: {
      name: 'dump',
      attr: 'magicFind',
      min: 0.03,
      max: 0.04
    },
    2: {
      name: 'crap',
      attr: 'magicFind',
      min: 0.05,
      max: 0.06
    },
    3: {
      name: 'mud',
      attr: 'diamondsPerSec',
      min: 0.5,
      max: 1
    },
    4: {
      name: 'trash',
      attr: 'maxDPS',
      min: 0.1,
      max: 0.5
    }
  },
  2: {
    0: {
      name: 'sand',
      attr: 'magicFind',
      min: 0.04,
      max: 0.05
    },
    1: {
      name: 'unluck',
      attr: 'magicFind',
      min: 0.04,
      max: 0.07
    },
    2: {
      name: 'coal',
      attr: 'diamondsPerSec',
      min: 1,
      max: 2
    },
    3: {
      name: 'moal',
      attr: 'maxDPS',
      min: 1,
      max: 2
    },
    4: {
      name: 'knowledge',
      attr: 'maxXpPerSec',
      min: 0.5,
      max: 1
    }
  },
  3: {
    0: {
      name: 'concrete',
      attr: 'magicFind',
      min: 0.07,
      max: 0.10
    },
    1: {
      name: 'wood',
      attr: 'magicFind',
      min: 0.11,
      max: 0.14
    },
    2: {
      name: 'ruby',
      attr: 'diamondsPerSec',
      min: 10,
      max: 20
    },
    3: {
      name: 'naked eye',
      attr: 'maxDPS',
      min: 2,
      max: 3
    },
    4: {
      name: 'experience',
      attr: 'maxXpPerSec',
      min: 1,
      max: 1.5
    }   
  },
  4: {
    0: {
      name: 'saphire',
      attr: 'magicFind',
      min: 0.12,
      max: 0.17
    },
    1: {
      name: 'luck',
      attr: 'magicFind',
      min: 0.18,
      max: 0.20
    },
    2: {
      name: 'vision',
      attr: 'diamondsPerSec',
      min: 40,
      max: 70
    },
    3: {
      name: 'flawlessness',
      attr: 'maxDPS',
      min: 3,
      max: 4
    },
    4: {
      name: 'wisdom',
      attr: 'maxXpPerSec',
      min: 1.5,
      max: 2
    } 
  },
  5: {
    0: {
      name: 'amethyst',
      attr: 'magicFind',
      min: 0.19,
      max: 0.22
    },
    1: {
      name: 'fate',
      attr: 'magicFind',
      min: 0.23,
      max: 0.26
    },
    2: {
      name: 'brightness',
      attr: 'diamondsPerSec',
      min: 80,
      max: 120
    },
    3: {
      name: 'perfection',
      attr: 'maxDPS',
      min: 4,
      max: 5
    },
    4: {
      name: 'mining',
      attr: 'goldenAxe',
      isInt: true,
      min: 1,
      max: 2
    },
    5: {
      name: 'jeweling',
      attr: 'jeweler',
      isInt: true,
      min: 1,
      max: 2
    },
    6: {
      name: 'training',
      attr: 'trainer',
      isInt: true,
      min: 1,
      max: 2
    },
    7: {
      name: 'blacksmithing',
      attr: 'blacksmith',
      isInt: true,
      min: 1,
      max: 2
    },
    8: {
      name: 'intelligence',
      attr: 'maxXpPerSec',
      min: 2,
      max: 2.5
    }
  },
  6: {
    0: {
      name: 'fortune',
      attr: 'magicFind',
      min: 0.26,
      max: 0.28
    },
    1: {
      name: 'glory',
      attr: 'magicFind',
      min: 0.28,
      max: 0.30
    },
    2: {
      name: 'shining',
      attr: 'diamondsPerSec',
      min: 130,
      max: 230
    },
    3: {
      name: 'perfection',
      attr: 'maxDPS',
      min: 5,
      max: 5.5
    },
    4: {
      name: 'alchemy',
      attr: 'goldenAxe',
      isInt: true,
      min: 3,
      max: 5
    },
    5: {
      name: 'sun',
      attr: 'jeweler',
      isInt: true,
      min: 3,
      max: 5
    },
    6: {
      name: 'wolves',
      attr: 'trainer',
      isInt: true,
      min: 3,
      max: 5
    },
    7: {
      name: 'platinum hammer',
      attr: 'blacksmith',
      isInt: true,
      min: 3,
      max: 5
    },
    8: {
      name: 'greatness',
      attr: 'maxXpPerSec',
      min: 3,
      max: 3.5
    }
  },
  7: {
    0: {
      name: 'magic',
      attr: 'magicFind',
      min: 0.30,
      max: 0.32
    },
    1: {
      name: 'gambling',
      attr: 'magicFind',
      min: 0.32,
      max: 0.33
    },
    2: {
      name: 'shining',
      attr: 'diamondsPerSec',
      min: 240,
      max: 350
    },
    3: {
      name: 'perfection',
      attr: 'maxDPS',
      min: 5.6,
      max: 6
    },
    4: {
      name: 'corruption',
      attr: 'goldenAxe',
      isInt: true,
      min: 6,
      max: 7
    },
    5: {
      name: 'true sight',
      attr: 'jeweler',
      isInt: true,
      min: 6,
      max: 7
    },
    6: {
      name: 'dragon',
      attr: 'trainer',
      isInt: true,
      min: 6,
      max: 7
    },
    7: {
      name: 'maul',
      attr: 'blacksmith',
      isInt: true,
      min: 6,
      max: 7
    },
    8: {
      name: 'god',
      attr: 'maxXpPerSec',
      min: 3.5,
      max: 4
    }
  },
  8: {
    0: {
      name: 'lucker',
      attr: 'magicFind',
      min: 0.35,
      max: 0.38
    },
    1: {
      name: 'gravity',
      attr: 'magicFind',
      min: 0.38,
      max: 0.42
    },
    2: {
      name: 'gems',
      attr: 'diamondsPerSec',
      min: 400,
      max: 500
    },
    3: {
      name: 'mind',
      attr: 'maxDPS',
      min: 6,
      max: 6.5
    },
    4: {
      name: 'wealth',
      attr: 'goldenAxe',
      isInt: true,
      min: 8,
      max: 10
    },
    5: {
      name: 'diamonds',
      attr: 'jeweler',
      isInt: true,
      min: 8,
      max: 10
    },
    6: {
      name: 'thousand lions',
      attr: 'trainer',
      isInt: true,
      min: 8,
      max: 10
    },
    7: {
      name: 'thunders',
      attr: 'blacksmith',
      isInt: true,
      min: 8,
      max: 10
    },
    8: {
      name: 'wonderer',
      attr: 'maxXpPerSec',
      min: 5,
      max: 6
    }
  },
  9: {
    0: {
      name: 'felicity',
      attr: 'magicFind',
      min: 0.43,
      max: 0.47
    },
    1: {
      name: 'great fortune',
      attr: 'magicFind',
      min: 0.48,
      max: 0.50
    },
    2: {
      name: 'pearls',
      attr: 'diamondsPerSec',
      min: 800,
      max: 1200
    },
    3: {
      name: 'nous',
      attr: 'maxDPS',
      min: 7,
      max: 7.5
    },
    4: {
      name: 'possessions',
      attr: 'goldenAxe',
      isInt: true,
      min: 11,
      max: 13
    },
    5: {
      name: 'sparkler',
      attr: 'jeweler',
      isInt: true,
      min: 11,
      max: 13
    },
    6: {
      name: 'stars',
      attr: 'trainer',
      isInt: true,
      min: 11,
      max: 13
    },
    7: {
      name: 'dark moon',
      attr: 'blacksmith',
      isInt: true,
      min: 11,
      max: 13
    },
    8: {
      name: 'proficiency',
      attr: 'maxXpPerSec',
      min: 6,
      max: 6.8
    }
  },
  10: {
    0: {
      name: 'bliss',
      attr: 'magicFind',
      min: 0.51,
      max: 0.54
    },
    1: {
      name: 'gladness',
      attr: 'magicFind',
      min: 0.55,
      max: 0.58
    },
    2: {
      name: 'pearls',
      attr: 'diamondsPerSec',
      min: 1800,
      max: 3000
    },
    3: {
      name: 'wit',
      attr: 'maxDPS',
      min: 7.5,
      max: 8
    },
    4: {
      name: 'golden stars',
      attr: 'goldenAxe',
      isInt: true,
      min: 13,
      max: 16
    },
    5: {
      name: 'scintilla',
      attr: 'jeweler',
      isInt: true,
      min: 13,
      max: 16
    },
    6: {
      name: 'visage',
      attr: 'trainer',
      isInt: true,
      min: 13,
      max: 16
    },
    7: {
      name: 'anvil',
      attr: 'blacksmith',
      isInt: true,
      min: 13,
      max: 16
    },
    8: {
      name: 'everlasting',
      attr: 'maxXpPerSec',
      min: 7,
      max: 7.5
    }
  }
}

// legendary[type][tc][itemN]
items.legendary = {
  //pickaxe
  0: {
    //tc
    1: {
      0: {
        name: 'Crapicker',
        variability: 1.5,
        attributes: {
          'goldPerSec': 21,
          'diamondsPerSec': 4,
          'magicFind': 0.05
        }      
      },
      1: {
        name: 'Diamond pick',
        variability: 1.5,
        attributes: {
          'goldPerSec': 10,
          'diamondsPerSec': 20,
          'magicFind': 0.09
        }      
      }
    },
    2: {
      0: {
        name: 'PickPock',
        variability: 1.5,
        attributes: {
          'goldPerSec': 50,
          'diamondsPerSec': 6,
          'magicFind': 0.06
        }
      },
      1: {
        name: 'Wise axe',
        variability: 1.5,
        attributes: {
          'goldPerSec': 90,
          'maxXpPerSec': 1,
          'magicFind': 0.08
        }
      }
    },
    3: {
      0: {
        name: 'Hands of Gold',
        variability: 1.5,
        attributes: {
          'goldPerSec': 300,
          'maxGPS': 3,
          'magicFind': 0.08,
          'maxXpPerSec': 1
        }
      },
      1: {
        name: 'Hands of Diamonds',
        variability: 1.5,
        attributes: {
          'goldPerSec': 200,
          'diamondsPerSec': 40,
          'maxDPS': 2,
          'magicFind': 0.08,
          'maxXpPerSec': 2
        }
      }
    },
    4: {
      0: {
        name: 'Argon',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1000,
          'diamondsPerSec': 30,
          'maxGPS': 3,
          'magicFind': 0.09,
          'maxXpPerSec': 2
        }
      },
      1: {
        name: 'Helium',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1400,
          'diamondsPerSec': 80,
          'maxGPS': 2,
          'maxDPS': 2,
          'maxXpPerSec': 2
        }
      },
      2: {
        name: 'Lucky pick',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1400,
          'diamondsPerSec': 80,
          'magicFind': 0.14,
          'maxGPS': 2,
          'maxXpPerSec': 2
        }
      }

    },
    5: {
      0: {
        name: 'The axe of Olaf',
        variability: 1.5,
        attributes: {
          'goldPerSec': 7000,
          'diamondsPerSec': 100,
          'maxGPS': 1,
          'magicFind': 0.20,
          'goldenAxe': 2,
          'blacksmith': 2,
          'maxXpPerSec': 2.5
        }
      },
      1: {
        name: 'Legend Spikes',
        variability: 1.5,
        attributes: {
          'goldPerSec': 7000,
          'maxGPS': 1,
          'magicFind': 0.22,
          'goldenAxe': 4,
          'blacksmith': 3,
          'maxXpPerSec': 2.5
        }
      }
    },
    6: {
      0: {
        name: 'The General',
        variability: 1.5,
        attributes: {
          'goldPerSec': 50000,
          'diamondsPerSec': 200,
          'maxGPS': 5,
          'magicFind': 0.30,
          'blacksmith': 5,
          'jeweler': 5,
          'maxXpPerSec': 3
        }
      },
      1: {
        name: 'The Oblivion',
        variability: 1.5,
        attributes: {
          'goldPerSec': 57000,
          'diamondsPerSec': 300,
          'maxGPS': 4,
          'magicFind': 0.32,
          'blacksmith': 7,
          'trainer': 4,
          'maxXpPerSec': 3.2
        }
      }
    },
    7: {
      0: {
        name: 'Wings of the Pterodactyl',
        variability: 1.5,
        attributes: {
          'goldPerSec': 350000,
          'diamondsPerSec': 800,
          'maxGPS': 5.5,
          'magicFind': 0.32,
          'goldenAxe': 3,
          'trainer': 7,
          'jeweler': 3,
          'maxXpPerSec': 4
        }
      },
      1: {
        name: 'Leafs of unity',
        variability: 1.5,
        attributes: {
          'goldPerSec': 380000,
          'diamondsPerSec': 1000,
          'maxGPS': 5,
          'magicFind': 0.37,
          'goldenAxe': 3,
          'trainer': 10,
          'blacksmith': 4,
          'maxXpPerSec': 4.2
        }
      }
    },
    8: {
      0: {
        name: 'The lost One',
        variability: 1.5,
        attributes: {
          'goldPerSec': 800000,
          'diamondsPerSec': 1100,
          'maxGPS': 6,
          'magicFind': 0.38,
          'goldenAxe': 2,
          'trainer': 10,
          'maxXpPerSec': 7
        }
      },
      1: {
        name: 'Gems of darkness',
        variability: 1.5,
        attributes: {
          'goldPerSec': 870000,
          'diamondsPerSec': 1600,
          'allSkills': 2,
          'maxGPS': 7,
          'goldenAxe': 4,
          'blacksmith': 10,
          'maxXpPerSec': 7
        }
      }
    },
    9: {
      0: {
        name: 'Gods Hand',
        variability: 1.5,
        attributes: {
          'goldPerSec': 2000000,
          'maxGPS': 7,
          'allSkills': 2,
          'magicFind': 0.43,
          'goldenAxe': 2,
          'jeweler': 5,
          'blacksmith': 5,
          'trainer': 5,
          'maxXpPerSec': 8
        }
      },
      1: {
        name: 'Gods Wrist',
        variability: 1.5,
        attributes: {
          'goldPerSec': 2200000,
          'maxGPS': 7,
          'magicFind': 0.47,
          'goldenAxe': 2,
          'jeweler': 10,
          'blacksmith': 6,
          'maxXpPerSec': 8
        }
      }
    },
    10: {
      0: {
        name: 'The Golddigger',
        variability: 1.5,
        attributes: {
          'goldPerSec': 7000000,
          'maxGPS': 8.5,
          'magicFind': 0.53,
          'goldenAxe': 3,
          'jeweler': 7,
          'blacksmith': 9,
          'maxXpPerSec': 8
        }
      },
      1: {
        name: 'Dimensional blade',
        variability: 1.5,
        attributes: {
          'goldPerSec': 9000000,
          'allSkills': 2,
          'maxGPS': 8.5,
          'trainer': 8,
          'goldenAxe': 4,
          'jeweler': 4,
          'blacksmith': 11,
          'maxXpPerSec': 8
        }
      }
    },
    11: {
      0: {
        name: 'The Guiardian',
        variability: 1.5,
        attributes: {
          'goldPerSec': 2500000,
          'maxGPS': 9,
          'maxDPS': 2,
          'magicFind': 0.58,
          'allSkills': 4,
          'goldenAxe': 2,
          'jeweler': 4,
          'blacksmith': 11,
          'maxXpPerSec': 9
        }
      },
      1: {
        name: 'Hunters rift',
        variability: 1.5,
        attributes: {
          'goldPerSec': 2500000,
          'maxGPS': 7,
          'maxDPS': 3,
          'magicFind': 0.58,
          'allSkills': 6,
          'goldenAxe': 2,
          'blacksmith': 11,
          'maxXpPerSec': 9
        }
      }
    },
    12: {
      0: {
        name: 'Hands of Justice',
        variability: 1.5,
        attributes: {
          'goldPerSec': 99900000,
          'maxGPS': 8,
          'maxDPS': 5,
          'magicFind': 0.63,
          'allSkills': 11,
          'goldenAxe': 1,
          'trainer': 8,
          'blacksmith': 11,
          'maxXpPerSec': 9
        }
      },
      1: {
        name: 'Darkness delivered',
        variability: 1.5,
        attributes: {
          'goldPerSec': 99900000,
          'maxGPS': 9,
          'maxDPS': 9,
          'magicFind': 0.68,
          'allSkills': 13,
          'goldenAxe': 1,
          'trainer': 10,
          'blacksmith': 11,
          'maxXpPerSec': 10
        }
      }
    }       
  },
  //armor
  1: {
    //tc
    1: {
      0: {
        name: 'Sand song',
        variability: 1.5,
        attributes: {
          'goldPerSec': 22,
          'diamondsPerSec': 2,
          'magicFind': 0.05
        }
      },
      1: {
        name: 'Rusty pack',
        variability: 1.5,
        attributes: {
          'goldPerSec': 30,
          'diamondsPerSec': 4,
          'magicFind': 0.07
        }
      }
    },
    2: {
      0: {
        name: 'Amaranth',
        variability: 1.5,
        attributes: {
          'goldPerSec': 51,
          'diamondsPerSec': 6,
          'magicFind': 0.06,
          'maxXpPerSec': 0.5
        }
      },
      1: {
        name: 'Leather of fox',
        variability: 1.5,
        attributes: {
          'goldPerSec': 70,
          'diamondsPerSec': 12,
          'magicFind': 0.07,
          'allSkills': 1
        }
      }
    },
    3: {
      0: {
        name: 'Golden leather',
        variability: 1.5,
        attributes: {
          'goldPerSec': 300,
          'maxGPS': 2,
          'diamondsPerSec': 20,
          'magicFind': 0.08,
          'maxXpPerSec': 1
        }
      },
      1: {
        name: 'Golden leather',
        variability: 1.5,
        attributes: {
          'goldPerSec': 300,
          'maxGPS': 2,
          'diamondsPerSec': 20,
          'magicFind': 0.08,
          'maxXpPerSec': 1
        }
      }
    },
    4: {
      0: {
        name: 'Smurf companion',
        variability: 1.5,
        attributes: {
          'goldPerSec': 700,
          'maxGPS': 3,
          'maxDPS': 1,
          'diamondsPerSec': 40,
          'magicFind': 0.10,
          'maxXpPerSec': 2
        }
      },
      1: {
        name: 'Bilbos top',
        variability: 1.5,
        attributes: {
          'goldPerSec': 800,
          'maxGPS': 4,
          'maxDPS': 1,
          'allSkills': 2,
          'diamondsPerSec': 60,
          'maxXpPerSec': 2
        }
      }
    },
    5: {
      0: {
        name: 'Goldskin',
        variability: 1.5,
        attributes: {
          'goldPerSec': 11000,
          'maxGPS': 2,
          'maxDPS': 4,
          'diamondsPerSec': 110,
          'magicFind': 0.20,
          'goldenAxe': 3,
          'jeweler': 4
        }
      },
      1: {
        name: 'Wise skin',
        variability: 1.5,
        attributes: {
          'goldPerSec': 11000,
          'maxGPS': 2,
          'allSkills': 2,
          'diamondsPerSec': 110,
          'magicFind': 0.20,
          'goldenAxe': 3,
          'maxXpPerSec': 5
        }
      }
    },
    6: {
      0: {
        name: 'Armor of the Lion tamer',
        variability: 1.5,
        attributes: {
          'goldPerSec': 80000,
          'maxGPS': 5,
          'maxDPS': 2,
          'diamondsPerSec': 220,
          'magicFind': 0.30,
          'goldenAxe': 5,
          'trainer': 6,
          'maxXpPerSec': 3
        }
      },
      1: {
        name: 'Metallica',
        variability: 1.5,
        attributes: {
          'goldPerSec': 90000,
          'maxGPS': 6,
          'maxDPS': 2,
          'magicFind': 0.32,
          'goldenAxe': 6,
          'trainer': 6,
          'maxXpPerSec': 3
        }
      }
    },
    7: {                      
      0: {
        name: 'Diamond Mail',
        variability: 1.5,
        attributes: {
          'goldPerSec': 320000,
          'maxGPS': 3,
          'maxDPS': 3,
          'diamondsPerSec': 720,
          'trainer': 2,
          'jeweler': 5,
          'blacksmith': 2,
          'maxXpPerSec': 5
        }
      },
      1: {
        name: 'Golden Mail',
        variability: 1.5,
        attributes: {
          'goldPerSec': 350000,
          'maxGPS': 7,
          'maxDPS': 3,
          'magicFind': 0.30,
          'trainer': 2,
          'goldenAxe': 5,
          'blacksmith': 2,
          'maxXpPerSec': 5
        }
      }
    },
    8: {                      
      0: {
        name: 'Kraken leather',
        variability: 1.5,
        attributes: {
          'goldPerSec': 580000,
          'maxGPS': 7,
          'maxDPS': 2,
          'diamondsPerSec': 900,
          'allSkills': 1,
          'trainer': 5,
          'jeweler': 3,
          'blacksmith': 2,
          'maxXpPerSec': 7
        }
      },
      1: {
        name: 'Chains of justice',
        variability: 1.5,
        attributes: {
          'goldPerSec': 600000,
          'maxGPS': 7,
          'diamondsPerSec': 900,
          'allSkills': 4,
          'trainer': 5,
          'magicFind': 0.32,
          'blacksmith': 4,
          'maxXpPerSec': 6
        }
      }
    },
    9: {                      
      0: {
        name: 'Alchemists cheats',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1000000,
          'maxGPS': 8,
          'magicFind': 0.30,
          'diamondsPerSec': 1200,
          'allSkills': 1,
          'trainer': 10,
          'jeweler': 7,
          'blacksmith': 7,
          'maxXpPerSec': 8
        }
      },
      1: {
        name: 'Hells angel',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1200000,
          'maxGPS': 9,
          'magicFind': 0.30,
          'diamondsPerSec': 1400,
          'allSkills': 3,
          'trainer': 2,
          'jeweler': 7,
          'blacksmith': 7,
          'maxXpPerSec': 9
        }
      }
    },
    10: {                      
      0: {
        name: 'Blacksmiths mail',
        variability: 1.5,
        attributes: {
          'goldPerSec': 5000000,
          'maxGPS': 8,
          'magicFind': 0.40,
          'diamondsPerSec': 8000,
          'trainer': 5,
          'jeweler': 2,
          'blacksmith': 17,
          'maxXpPerSec': 8.5
        }
      },
      1: {
        name: 'True gold',
        variability: 1.5,
        attributes: {
          'goldPerSec': 5500000,
          'maxGPS': 8,
          'magicFind': 0.40,
          'diamondsPerSec': 8000,
          'allSkills': 3,
          'trainer': 5,
          'jeweler': 2,
          'maxXpPerSec': 8.5
        }
      }
    },
    11: {                      
      0: {
        name: 'Corpse of diamonds',
        variability: 1.5,
        attributes: {
          'goldPerSec': 15000000,
          'maxGPS': 4,
          'magicFind': 0.45,
          'diamondsPerSec': 40000,
          'allSkills': 4,
          'trainer': 10,
          'jeweler': 2,
          'blacksmith': 15,
          'maxXpPerSec': 8.5
        }
      },
      1: {
        name: 'Raging mail',
        variability: 1.5,
        attributes: {
          'goldPerSec': 17000000,
          'maxGPS': 7,
          'magicFind': 0.47,
          'diamondsPerSec': 70000,
          'allSkills': 6,
          'trainer': 5,
          'jeweler': 2,
          'blacksmith': 12,
          'maxXpPerSec': 9
        }
      }
    },
    12: {                      
      0: {
        name: 'Dream of fortune',
        variability: 1.5,
        attributes: {
          'goldPerSec': 55000000,
          'maxGPS': 4,
          'magicFind': 0.48,
          'diamondsPerSec': 200000,
          'allSkills': 11,
          'trainer': 5,
          'jeweler': 10,
          'blacksmith': 10,
          'maxXpPerSec': 8.5
        }
      },
      1: {
        name: 'Peace',
        variability: 1.5,
        attributes: {
          'goldPerSec': 60000000,
          'maxGPS': 7,
          'magicFind': 0.48,
          'diamondsPerSec': 200000,
          'allSkills': 14,
          'trainer': 5,
          'jeweler': 10,
          'blacksmith': 12,
          'maxXpPerSec': 8.5
        }
      }
    }     
  },
  //helm
  2: {    //tc
    1: {
      0: {
        name: 'Glorious waste',
        variability: 1.5,
        attributes: {
          'goldPerSec': 22,
          'diamondsPerSec': 2,
          'magicFind': 0.06
        }
      },
      1: {
        name: 'Lucky hat',
        variability: 1.5,
        attributes: {
          'goldPerSec': 22,
          'diamondsPerSec': 2,
          'magicFind': 0.10
        }
      }
    },
    2: {
      0: {
        name: 'Madmud',
        variability: 1.5,
        attributes: {
          'goldPerSec': 53,
          'diamondsPerSec': 6,
          'magicFind': 0.06,
          'maxXpPerSec': 0.5
        }
      },
      1: {
        name: 'Golden Wisp',
        variability: 1.5,
        attributes: {
          'goldPerSec': 85,
          'maxGPS': 1,
          'magicFind': 0.08,
          'maxXpPerSec': 1
        }
      }
    },
    3: {
      0: {
        name: 'Miners Lamp',
        variability: 1.5,
        attributes: {
          'goldPerSec': 300,
          'diamondsPerSec': 19,
          'magicFind': 0.10,
          'maxGPS': 1,
          'maxXpPerSec': 1
        }
      },
      1: {
        name: 'Goldmaker',
        variability: 1.5,
        attributes: {
          'goldPerSec': 400,
          'diamondsPerSec': 19,
          'magicFind': 0.11,
          'maxGPS': 2,
          'maxXpPerSec': 1
        }
      }
    },
    4: {
      0: {
        name: 'Cobra mask',
        variability: 1.5,
        attributes: {
          'goldPerSec': 800,
          'diamondsPerSec': 45,
          'magicFind': 0.10,
          'maxGPS': 2,
          'maxXpPerSec': 3
        }
      },
      1: {
        name: 'Small cap',
        variability: 1.5,
        attributes: {
          'goldPerSec': 900,
          'diamondsPerSec': 50,
          'magicFind': 0.13,
          'maxGPS': 3,
          'maxXpPerSec': 3
        }
      }
    },
    5: {
      0: {
        name: 'Necroticum',
        variability: 1.5,
        attributes: {
          'goldPerSec': 10000,
          'diamondsPerSec': 130,
          'magicFind': 0.23,
          'maxGPS': 4,
          'trainer': 3,
          'jeweler': 4,
          'maxXpPerSec': 4
        }
      },
      1: {
        name: 'Hellmouth',
        variability: 1.5,
        attributes: {
          'goldPerSec': 12000,
          'diamondsPerSec': 140,
          'magicFind': 0.27,
          'allSkills': 4,
          'trainer': 3,
          'jeweler': 4,
          'maxXpPerSec': 4
        }
      }
    },
    6: {
      0: {
        name: 'Diamond mind',
        variability: 1.5,
        attributes: {
          'goldPerSec': 70000,
          'diamondsPerSec': 290,
          'magicFind': 0.30,
          'maxDPS': 5,
          'jeweler': 6,
          'goldenAxe': 2,
          'maxXpPerSec': 5
        }
      },
      1: {
        name: 'Nightfall',
        variability: 1.5,
        attributes: {
          'goldPerSec': 50000,
          'diamondsPerSec': 290,
          'magicFind': 0.32,
          'allSkills': 4,
          'jeweler': 6,
          'goldenAxe': 3,
          'maxXpPerSec': 5
        }
      }
    },
    7: {
      0: {
        name: 'Helm of Hope',
        variability: 1.5,
        attributes: {
          'goldPerSec': 400000,
          'diamondsPerSec': 1090,
          'magicFind': 0.32,
          'jeweler': 2,
          'goldenAxe': 2,
          'trainer':2,
          'blacksmith': 2,
          'maxXpPerSec': 6
        }
      },
      1: {
        name: 'Black Lantern',
        variability: 1.5,
        attributes: {
          'goldPerSec': 500000,
          'magicFind': 0.32,
          'allSkills': 3,
          'goldenAxe': 2,
          'trainer':2,
          'blacksmith': 2,
          'maxXpPerSec': 6
        }
      }
    },
    8: {
      0: {
        name: 'Blessed tiara',
        variability: 1.5,
        attributes: {
          'goldPerSec': 700000,
          'diamondsPerSec': 1290,
          'magicFind': 0.37,
          'goldenAxe': 9,
          'trainer':2,
          'blacksmith': 10,
          'maxXpPerSec': 7
        }
      },
      1: {
        name: 'Shamans trophy',
        variability: 1.5,
        attributes: {
          'goldPerSec': 700000,
          'diamondsPerSec': 1290,
          'magicFind': 0.47,
          'allSkills': 6,
          'blacksmith': 10,
          'maxXpPerSec': 5
        }
      }
    },
    9: {
      0: {
        name: 'Diadem of lights',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1200000,
          'diamondsPerSec': 1290,
          'magicFind': 0.42,
          'goldenAxe': 10,
          'blacksmith': 10,
          'jeweler': 8,
          'maxXpPerSec': 7
        }
      },
      1: {
        name: 'Call of wisdom',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1200000,
          'diamondsPerSec': 1290,
          'magicFind': 0.40,
          'allSkills': 7,
          'blacksmith': 10,
          'jeweler': 8,
          'maxXpPerSec': 10
        }
      }
    },
    10: {
      0: {
        name: 'Necromancers Glory',
        variability: 1.5,
        attributes: {
          'goldPerSec': 5000000,
          'diamondsPerSec': 8000,
          'magicFind': 0.52,
          'goldenAxe': 8,
          'trainer': 15,
          'jeweler': 5,
          'maxXpPerSec': 7.5
        }
      },
      1: {
        name: 'Headhunters legend',
        variability: 1.5,
        attributes: {
          'goldPerSec': 7000000,
          'diamondsPerSec': 8000,
          'magicFind': 0.52,
          'allSkills': 5,
          'trainer': 11,
          'jeweler': 5,
          'maxXpPerSec': 7.5
        }
      }
    },
    11: {
      0: {
        name: 'The Beast',
        variability: 1.5,
        attributes: {
          'goldPerSec': 15000000,
          'diamondsPerSec': 50000,
          'maxGPS': 3,
          'magicFind': 0.57,
          'allSkills': 4,
          'trainer': 15,
          'jeweler': 5,
          'maxXpPerSec': 7.5
        }
      },
      1: {
        name: 'Last Supper',
        variability: 1.5,
        attributes: {
          'goldPerSec': 15000000,
          'diamondsPerSec': 50000,
          'maxGPS': 3,
          'magicFind': 0.57,
          'allSkills': 7,
          'blacksmith': 15,
          'jeweler': 5,
          'maxXpPerSec': 7.5
        }
      }
    },
    12: {
      0: {
        name: 'Prometheus',
        variability: 1.5,
        attributes: {
          'goldPerSec': 45000000,
          'diamondsPerSec': 250000,
          'maxGPS': 5,
          'magicFind': 0.57,
          'allSkills': 10,
          'trainer': 7,
          'jeweler': 10,
          'maxXpPerSec': 8
        }
      },
      0: {
        name: 'Emporium',
        variability: 1.5,
        attributes: {
          'goldPerSec': 50000000,
          'diamondsPerSec': 250000,
          'maxGPS': 7,
          'magicFind': 0.60,
          'allSkills': 10,
          'trainer': 7,
          'blacksmith': 4,
          'maxXpPerSec': 9
        }
      }
    }      
  },
  //ring
  3: {    //tc
    1: {
      0: {
        name: 'Dirty finger',
        variability: 1.5,
        attributes: {
          'goldPerSec': 22,
          'diamondsPerSec': 2,
          'magicFind': 0.06
        }
      },
      1: {
        name: 'Pendulum',
        variability: 1.5,
        attributes: {
          'goldPerSec': 37,
          'diamondsPerSec': 2,
          'magicFind': 0.07
        }
      }
    },
    2: {
      0: {
        name: 'Hands of coal',
        variability: 1.5,
        attributes: {
          'goldPerSec': 53,
          'diamondsPerSec': 10,
          'magicFind': 0.06
        }
      },
      1: {
        name: 'Runic master',
        variability: 1.5,
        attributes: {
          'goldPerSec': 70,
          'diamondsPerSec': 10,
          'magicFind': 0.07,
          'allSkills': 1
        }
      }
    },
    3: {
      0: {
        name: 'Lucky finger',
        variability: 1.5,
        attributes: {
          'goldPerSec': 200,
          'maxGPS': 1,
          'diamondsPerSec': 27,
          'magicFind': 0.12
        }
      },
      0: {
        name: 'Skillshot',
        variability: 1.5,
        attributes: {
          'goldPerSec': 200,
          'diamondsPerSec': 27,
          'magicFind': 0.12,
          'allSkills': 2
        }
      }
    },
    4: {
      0: {
        name: 'Fakers Titanium',
        variability: 1.5,
        attributes: {
          'goldPerSec': 800,
          'maxGPS': 2,
          'maxDPS': 1,
          'diamondsPerSec': 49,
          'magicFind': 0.10
        }
      },
      1: {
        name: 'Hundred gems',
        variability: 1.5,
        attributes: {
          'goldPerSec': 600,
          'maxGPS': 1,
          'maxDPS': 3,
          'diamondsPerSec': 100,
          'magicFind': 0.11
        }
      }
    },
    5: {
      0: {
        name: 'Swarovskis luck',
        variability: 1.5,
        attributes: {
          'goldPerSec': 7000,
          'maxGPS': 4,
          'maxDPS': 2,
          'diamondsPerSec': 110,
          'magicFind': 0.30,
          'jeweler': 3
        }
      },
      1: {
        name: 'Long voyage',
        variability: 1.5,
        attributes: {
          'goldPerSec': 9000,
          'maxGPS': 3,
          'maxDPS': 2,
          'diamondsPerSec': 110,
          'magicFind': 0.30,
          'allSkills': 2,
          'blacksmith': 3
        }
      }
    },
    6: {
      0: {
        name: 'Blood diamond',
        variability: 1.5,
        attributes: {
          'goldPerSec': 70000,
          'maxGPS': 3,
          'maxDPS': 3,
          'diamondsPerSec': 300,
          'jeweler': 5,
          'blacksmith': 2,
          'goldenAxe': 2
        }
      },
      1: {
        name: 'Ring of sands',
        variability: 1.5,
        attributes: {
          'goldPerSec': 70000,
          'maxGPS': 4,
          'diamondsPerSec': 300,
          'magicFind': 0.20,
          'jeweler': 1,
          'blacksmith': 6,
          'goldenAxe': 2
        }
      }
    },
    7: {
      0: {
        name: 'Goldies ring',
        variability: 1.5,
        attributes: {
          'goldPerSec': 370000,
          'maxGPS': 5,
          'maxDPS': 1,
          'diamondsPerSec': 1500,
          'jeweler': 1,
          'blacksmith': 1,
          'goldenAxe': 3
        }
      },
      1: {
        name: 'The Emperor',
        variability: 1.5,
        attributes: {
          'goldPerSec': 380000,
          'maxGPS': 4,
          'diamondsPerSec': 1500,
          'allSkills': 2,
          'blacksmith': 1,
          'goldenAxe': 3
        }
      }
    },
    8: {
      0: {
        name: 'Natures call',
        variability: 1.5,
        attributes: {
          'goldPerSec': 670000,
          'maxGPS': 5,
          'diamondsPerSec': 1500,
          'trainer': 5,
          'blacksmith': 5,
          'goldenAxe': 3
        }
      },
      1: {
        name: 'Wolf eye',
        variability: 1.5,
        attributes: {
          'goldPerSec': 670000,
          'maxGPS': 3,
          'diamondsPerSec': 1500,
          'magicFind': 0.19,
          'allSkills': 2,
          'blacksmith': 5
        }
      }
    },
    9: {
      0: {
        name: 'Shadow of the Dragon',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1000000,
          'maxGPS': 6,
          'diamondsPerSec': 1700,
          'trainer': 6,
          'blacksmith': 10,
          'goldenAxe': 2,
          'jeweler': 2
        }
      },
      1: {
        name: 'Sanctuary',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1000000,
          'diamondsPerSec': 1700,
          'magicFind': 0.25,
          'allSkills': 5,
          'blacksmith': 12,
          'goldenAxe': 2,
          'jeweler': 3
        }
      }
    },
    10: {
      0: {
        name: 'The Precious',
        variability: 1.5,
        attributes: {
          'goldPerSec': 5000000,
          'maxGPS': 6,
          'maxGPS': 5,
          'trainer': 10,
          'blacksmith': 10,
          'goldenAxe': 4,
          'jeweler': 3
        }
      },
      1: {
        name: 'Lucky One',
        variability: 1.5,
        attributes: {
          'goldPerSec': 5000000,
          'maxGPS': 6,
          'magicFind': 0.30,
          'trainer': 10,
          'blacksmith': 12,
          'goldenAxe': 4,
          'jeweler': 7
        }
      }
    },
    11: {
      0: {
        name: 'The Peacemaker',
        variability: 1.5,
        attributes: {
          'goldPerSec': 15000000,
          'maxGPS': 4,
          'maxGPS': 5,
          'allSkills': 3,
          'trainer': 10,
          'blacksmith': 10,
          'goldenAxe': 4,
          'jeweler': 7
        }
      },
      1: {
        name: 'Shadow dash',
        variability: 1.5,
        attributes: {
          'goldPerSec': 15000000,
          'maxGPS': 5,
          'allSkills': 4,
          'trainer': 10,
          'blacksmith': 10,
          'goldenAxe': 4,
          'jeweler': 7
        }
      }
    },
    12: {
      0: {
        name: 'Earth Spirit',
        variability: 1.5,
        attributes: {
          'goldPerSec': 45000000,
          'maxGPS': 2,
          'allSkills': 10,
          'trainer': 14,
          'blacksmith': 7,
          'goldenAxe': 2,
          'jeweler': 10
        }
      }
    }    
  },
  //amulet
  4: {
    //tc
    1: {
      0: {
        name: 'Bad trip',
        variability: 1.5,
        attributes: {
          'goldPerSec': 22,
          'diamondsPerSec': 2,
          'magicFind': 0.05
        }
      }
    },
    2: {
      0: {
        name: 'Worst Hope',
        variability: 1.5,
        attributes: {
          'goldPerSec': 53,
          'diamondsPerSec': 10,
          'magicFind': 0.06
        }
      }
    },
    3: {
      0: {
        name: 'Pony Necklace',
        variability: 1.5,
        attributes: {
          'goldPerSec': 300,
          'diamondsPerSec': 20,
          'magicFind': 0.09
        }
      }
    },
    4: {
      0: {
        name: 'Goldfinger',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1200,
          'maxGPS': 3,
          'magicFind': 0.11
        }
      }
    },
    5: {
      0: {
        name: 'Stolen fate',
        variability: 1.5,
        attributes: {
          'goldPerSec': 9800,
          'maxGPS': 4,
          'magicFind': 0.25,
          'goldenAxe': 3,
          'trainer': 3
        }
      }
    },
    6: {
      0: {
        name: 'Platinum chains',
        variability: 1.5,
        attributes: {
          'goldPerSec': 70000,
          'maxGPS': 5,
          'magicFind': 0.30,
          'goldenAxe': 2,
          'trainer': 2,
          'jeweler': 1,
          'blacksmith': 1
        }
      }
    },
    7: {
      0: {
        name: 'Amulet of the Occult',
        variability: 1.5,
        attributes: {
          'goldPerSec': 380000,
          'maxGPS': 5.5,
          'magicFind': 0.36,
          'goldenAxe': 3,
          'trainer': 4,
          'jeweler': 1,
          'blacksmith': 1
        }
      }
    },
    8: {
      0: {
        name: 'Medal of Honor',
        variability: 1.5,
        attributes: {
          'goldPerSec': 670000,
          'maxGPS': 6,
          'magicFind': 0.40,
          'trainer': 10,
          'jeweler': 4,
        }
      }
    },
    9: {
      0: {
        name: 'Relic of the Ancients',
        variability: 1.5,
        attributes: {
          'goldPerSec': 1100000,
          'maxGPS': 6.5,
          'magicFind': 0.43,
          'blacksmith': 10,
          'jeweler': 5,
          'maxXpPerSec': 3
        }
      }
    },
    10: {
      0: {
        name: 'Dwarf Kings Amulet',
        variability: 1.5,
        attributes: {
          'goldPerSec': 4100000,
          'maxGPS': 9.5,
          'maxDPS': 4,
          'magicFind': 0.50,
          'blacksmith': 15,
          'trainer': 10,
          'maxXpPerSec': 4
        }
      }
    },
    11: {
      0: {
        name: 'Occult Star',
        variability: 1.5,
        attributes: {
          'goldPerSec': 13100000,
          'maxGPS': 6,
          'maxDPS': 4,
          'magicFind': 0.51,
          'allSkills': 3,
          'blacksmith': 10,
          'trainer': 10,
          'maxXpPerSec': 4.5
        }
      }
    },
    12: {
      0: {
        name: 'Chromatic Ire',
        variability: 1.5,
        attributes: {
          'goldPerSec': 22100000,
          'maxGPS': 5,
          'maxDPS': 6,
          'magicFind': 0.51,
          'allSkills': 7,
          'blacksmith': 14,
          'trainer': 14,
          'maxXpPerSec': 5
        }
      }
    }        
  }
};
