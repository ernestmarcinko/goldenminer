var output = new Object();

output = {
  load: function() {
    output.loadStats();
    output.loadMinions();
    output.loadBuildings();
    output.loadItems();
    output.loadSkills();
    output.loadGamble();
    output.checkButtons();
    output.loadOptions();
    output.refreshStats();
    $(window).resize(function() {
       $('#mines').css('height', $('#mines').width());
    });
    setTimeout(function() {
      $(window).resize();
    }, 200);
    if (game.isMining==null) {
      $('.mining').addClass('start').html("Start Mining!");
    } else {
      $('.mining').removeClass('start').html("Stop Mining!");      
    }
    $('#leaveplanet').css('display', 'none');    
  },
  
  loadTravelButton: function() {
     $('#leaveplanet').css('display', 'inline-block');
  },
  
  loadItems: function() {

    output.loadCharacter();       
    output.loadFinds();    
    output.loadStash();     
    output.loadGamble();
  },
  
  loadStats: function() { 
    $('#planet').html(planets[game.data.planet].name);
    $('#gold').html(sepNum(game.data.character.gold.toFixed(0)));
    $('#diamond').html(sepNum(game.data.character.diamonds.toFixed(1)));
    if (game.data.potions.goldFrenzy>0)
      $('#golds').html(
        sepNum(game.data.character.goldPerSec.toFixed(0)) +
        " <span class='bonus'>(+800%, " + game.data.potions.goldFrenzy + ")</span> "
      );
    else
      $('#golds').html(sepNum(game.data.character.goldPerSec.toFixed(1)));
      
    if (game.data.potions.diamondFrenzy>0)
      $('#diamonds').html(
        sepNum(game.data.character.diamondsPerSec.toFixed(2)) +
        " <span class='bonus'>(+800%, " + game.data.potions.diamondFrenzy + ")</span> "
      );
    else
      $('#diamonds').html(sepNum(game.data.character.diamondsPerSec.toFixed(2)));

    $('#clickeff').html(sepNum(game.data.character.clickEfficiency.toFixed(0))+ "%");
    
    
    $('#xp').html(sepNum(game.data.character.xp.toFixed(0)) + "/" + sepNum(game.data.character.nextLvlXp.toFixed(0)));
    if (game.data.potions.mfFrenzy>0)
      $('#mfs').html(
        sepNum(game.data.character.magicFind.toFixed(2)) + "%" +
        " <span class='bonus'>(+15%, " + game.data.potions.mfFrenzy + ")</span> "
      );
    else
      $('#mfs').html(sepNum(game.data.character.magicFind.toFixed(2)) + "%");
          
    //$('#xp').html(sepNum(game.data.character.xp.toFixed(0))); 
    $('#xpbar').css("width", (game.data.character.xp / game.data.character.nextLvlXp)*100 + "%");
    $('#level').html(sepNum(game.data.character.level.toFixed(0)));
    $('#skill').html(sepNum(game.data.character.skill.toFixed(0)));
    //$('#mfs').html(sepNum(game.data.character.magicFind.toFixed(2)) + "%");
    //$('#mtime').html(sepNum(game.data.mineTime));
    $('#ptime').html((game.data.totalTime+'').toHHMMSS()); 
    $('#xps').html(game.getXpPerSec().toFixed(0));
  },

  loadCharacter: function() {
    $("#character .eq").html('');
    $(game.data.character.equipment).each(function(){
      if (this==window || this.price==null || this.attributes==null) return;
      var item = output.createItemOutput(this);
      item.attr('eqid', this.type);
      $("#character .eq[type="+this.type+"]").html('');
      $(".stash", item).css('display', 'inline-block');
      $(".sell", item).css('display', 'inline-block');
      $(".equip", item).css('display', 'none');
      $("#character .eq[type="+this.type+"]").append(item);
    }); 
  },
  
  loadSkills: function() {
    for (var i in skills) {
      var skillLevel = game.data.character[i];
      var skillBonus =  skillLevel * skills[i].value;
      var nextLevelSkillBonus = (skillLevel+1) * skills[i].value;
      $('#skills .skill'+skills[i].id+' .level').html(skillLevel);
      var details = $('#skills .skill'+skills[i].id+' .details');
      details.html("");
      var output = " \
         <p class='title'>" + skills[i].name + "</p> \
         <p class='description'>" + skills[i].description + "</p> \
         <p class='currentLevel'><span class='desc'>Current level: </span><span class='val'>" + skillLevel + "</span></p> \
         <p class='currentBonus'><span class='desc'>Current bonus: </span><span class='val'>+" + skillBonus.toFixed(1) + skills[i].valueSuffix + "</span></p> \
         <p class='nextLevelBonus'><span class='desc'>Next level bonus: </span><span class='val'>+" + nextLevelSkillBonus.toFixed(1) + skills[i].valueSuffix + "</span></p> \
         <p class='cost'>Learn cost: 1 skill point</p> \
         <a href='#' skillid='" + i + "' class='learn'>Learn</a> \
      ";
      details.html(output);
    }
  },
  
  loadFinds: function() {
    var i = 0;
    $("#finds .content").html("");
    $(game.data.finds).each(function(){
      
      var item = output.createItemOutput(this);
      item.attr('findid', i);
      i++;
      $(".stash", item).css('display', 'inline-block');
      $(".sell", item).css('display', 'inline-block');
      $(".equip", item).css('display', 'inline-block');
      $("#finds .content").append(item);
    });
    output.loadSFCounters();     
  },
  loadStash: function() {
    var i = 0;
    game.stashIntegrityCheck();
    $("#stash .content").html("");
    $(game.data.stash).each(function(){
      var item = output.createItemOutput(this);
      item.attr('stashid', i);
      i++;
      $(".stash", item).css('display', 'none');
      $(".sell", item).css('display', 'inline-block');
      $(".equip", item).css('display', 'inline-block');
      $("#stash .content").append(item);
    });
    output.loadSFCounters();  
  },
  loadGamble: function() {
    if ($("#gamblecurrency").val()==0)
      $("#gamblecost").html(sepNum(game.getGambleCost()[0].toFixed(0)));
    else
      $("#gamblecost").html(sepNum(game.getGambleCost()[1].toFixed(0)));
  },
  loadMinions: function() {
    $('#minions').html('');
    for (var i in minions) {
      var owned = 0;
      if (game.data.character.minions[i]!=null)
        owned = game.data.character.minions[i]; 
      var minion = minions[i];
      var cost = game.getMinionPrice(i);
      var atts = '';
      atts += "<h4>One minion bonus</h4>";
      for(var j in minions[i].attributes) {
          atts += "<p class='attribute'> + " + sepNum(minions[i].attributes[j].toFixed(items.attributes[j].fixed)) + " " + items.attributes[j].name + "</p>";
      }
      atts += "<h4>Overall</h4>";
      for(var j in minions[i].attributes) {
          atts += "<p class='attribute'> + " + sepNum(minions[i].attributes[j]*owned.toFixed(items.attributes[j].fixed)) + " " + items.attributes[j].name + "</p>";
      }
      var canBuy = (cost>game.data.character.gold)?' disabled':'';
      var canSell = (owned<1)?' disabled':'';   
      var output = $("<div class='minion minion"+ i +"' minionId='" + i + "'> \
            <h4>"+ minions[i].name +"</h4> \
               <a href='#' class='info' minionId='" + i + "'>INFO</a> \
               <a href='#' class='buy"+canBuy+"' minionId='" + i + "'>BUY</a> \
               <div class='clear'></div> \
            <div class='description'> \
               Owned: <span class='owned'>"+owned+"</span> | Cost: <span class='cost'>"+ sepNum(cost.toFixed(0)) +" gold</span> \
               </div><div class='attributes'>"+ atts +"</div> \
        </div>");
      $('#minions').append(output);
    }
  },
  loadBuildings: function() {
    $('#buildings').html('');
    for (var i in buildings) {
      var funded = 0;
      if (game.data.buildings[i].funds!=null)
        funded = game.data.buildings[i].funds; 
      var building = buildings[i];
      var cost = game.getBuildingPrice(i);
      var currency = (buildings[i].currency==0)?'gold':'diamonds';
      var atts = '';  
      atts += "<h4>Description</h4>";
      atts += "<p class='attribute'>"+building.description+"</p>";
      var canBuy = (cost>game.data.character.gold)?' disabled':'';
      if (buildings[i].type==0) {  
        // Schools
        var output = $("<div class='building school building"+ i +"' buildingId='" + i + "'> \
              <h4>"+ buildings[i].name +"</h4> \
                 <a href='#' class='info' buildingId='" + i + "'>INFO</a> \
                 <a href='#' class='fund"+canBuy+"' buildingId='" + i + "'>FUND</a> \
                 <div class='clear'></div> \
              <div class='description'> \
                 Funded: <span class='owned'>"+funded+"/5 times</span> | Cost: <span class='cost'>"+ sepNum(cost.toFixed(0)) +" "+ currency +"</span> \
                 | Next item in<span class='timer'>: " + (game.data.buildings[i].timer+'').toHHMMSS() + "</span> \
                 </div><div class='attributes'>"+ atts +"</div> \
          </div>");
        $('#buildings').append(output);
      } else {
        //Temples
        var output = $("<div class='building temple building"+ i +"' buildingId='" + i + "'> \
              <h4>"+ buildings[i].name +"</h4> \
                 <a href='#' class='info' buildingId='" + i + "'>INFO</a> \
                 <a href='#' class='fund"+canBuy+"' buildingId='" + i + "'>Sacrifice</a> \
                 <div class='clear'></div> \
              <div class='description'> \
                 Sacrifice count: <span class='owned'>"+funded+"</span> | Grants permanent "+ buildings[i].xpBonus +" XP/second for <span class='cost'>1 trillion "+ currency +"</span> \
                 </div><div class='attributes'>"+ atts +"</div> \
          </div>");
        $('#buildings').append(output);
      }
    }
  },
  refreshBuildings: function() {
    $('div.building.school').each(function(){
        var i = $(this).attr('buildingid');
        var cost = game.getBuildingPrice(i);
        var funded = game.data.buildings[i].funds;
        var currency = (buildings[i].currency==0)?'gold':'diamonds';
        $('.cost', this).html(sepNum(cost.toFixed(0))+ " "+currency);
        $('.owned', this).html(funded+"/5 times");
        $('.timer', this).html(" " + (game.data.buildings[i].timer+'').toHHMMSS());
    });
    $('div.building.temple').each(function(){
        var i = $(this).attr('buildingid');
        var funded = game.data.buildings[i].funds;
        $('.owned', this).html(funded);
    });
  },   
  loadFind: function() {
    var item = output.createItemOutput(game.data.finds[game.data.finds.length - 1]);
    item.attr('findid', (game.data.finds.length - 1)); 
    animations.dropItem();
    item.addClass('animated pulse');   
    setTimeout(function(){
      item.removeClass('animated pulse');
    }, 600);       
    $('#finds .content').append(item);
    output.loadSFCounters();    
  },
  loadGambled: function() {
    var item = output.createItemOutput(game.data.finds[game.data.finds.length - 1]);
    item.attr('findid', (game.data.finds.length - 1)); 
    animations.dropGambled();
    item.addClass('animated pulse');   
    $('#finds .content').append(item); 
    output.loadSFCounters(); 
    setTimeout(function(){
      item.removeClass('animated pulse');
    }, 600);         

  },
  ifEquipped: function(item) {
    var id = item.attr('findid');
    var attr = "";
    if (id==null || id=='') {
      //check for eq
      id = item.attr('stashid');
      if (id==null || id=='') return;
      //Stashed
      var stat = game.getStatsIfEquipped('stash', id);
      if (stat == null) return null;
      for (var i in stat) {
          var sclass = (stat[i]>0)?'plus':'minus';
          var needPlus = (stat[i]>0)?'+':'';
          attr += '<p>'+stats[i]+': <span class="'+sclass+ '">' + needPlus + sepNum(stat[i].toFixed(items.attributes[i].fixed))+'</span></p>';
      }
    } else {
      //found
      var stat = game.getStatsIfEquipped('finds', id);
      if (stat == null) return null;
      for (var i in stat) {
          var sclass = (stat[i]>0)?'plus':'minus';
          var needPlus = (stat[i]>0)?'+':'';
          attr += '<p>'+stats[i]+': <span class="'+sclass+ '">'  + needPlus +sepNum(stat[i].toFixed(items.attributes[i].fixed))+'</span></p>';
      }
    }
    $('#ifequipped .content').html(attr);
    return attr;
  },
  
  loadSFCounters: function() {
     $("#finds span.count").html('(' + game.data.finds.length + '/250)');
     $("#stash span.count").html('(' + game.data.stash.length + '/250)');
  },
  
  createItemOutput: function(item) {
    var atts = '';
    var socketedWith = '';
    if (item.type>7 && item.type!=13 && item.type<100) {
    // potion
      var ritem = $("<div href='#' class='item itemquality"+item.quality+" \
                  itemtype"+item.type+"'>\
                    <div class='description'> \
                         <span class='title'>"+item.name+"</span> \
                         <p class='type'>["+ items.types[item.type] +"]</p> \
                         <p class='desc'>"+ items.potions[item.potionType].description +"</p> \
                         <p class='price'>Selling price: "+sepNum(item.price.toFixed(0))+" gold</p> \
                         " + atts + " \
                         <a href='#' class='drink' action='drink'>Drink</a>\
                         <a href='#' class='sell' action='sell'>Sell</a>\
                         <a href='#' class='stash' action='stash'>Stash</a>\
                    </div>\
                  </div>");     
    } else if (item.type>4 && item.type<100 || item.type==13) {
    //craft and consumable
      var ritem = $("<div href='#' class='item itemquality"+item.quality+" \
                  itemtype"+item.type+"'>\
                    <div class='description'> \
                         <span class='title'>"+item.name+"</span> \
                         <p class='type'>["+ items.types[item.type] +"]</p> \
                         <p class='desc'>"+ items.scrolls[item.scrollType].description +"</p> \
                         <p class='price'>Selling price: "+sepNum(item.price.toFixed(0))+" gold</p> \
                         <p class='price'>Crafting price: <b>"+sepNum(item.diamondsCost.toFixed(0))+"</b> diamonds</p> \
                         " + atts + " \
                         <a href='#' class='craft' action='craft'>Craft</a>\
                         <a href='#' class='sell' action='sell'>Sell</a>\
                         <a href='#' class='stash' action='stash'>Stash</a>\
                    </div>\
                  </div>"); 
                     
    } else if (item.type>=100) {   
    // gems
      var ritem = $("<div href='#' class='item itemquality"+item.quality+" \
                  itemtype"+item.type+"'>\
                    <div class='description'> \
                         <span class='title'>"+item.name+"</span> \
                         <p class='type'>["+ items.types[item.type] +"]</p> \
                         <p class='desc'>"+ items.gems[item.gemType][item.gemSize].description +"</p> \
                         <p class='type'>Drag this item from your <b>stash</b> to an <b>equipped</b> item with open sockets.</p> \
                         <p class='price'>Selling price: "+sepNum(item.price.toFixed(0))+" gold</p> \
                         " + atts + " \
                         <a href='#' class='sell' action='sell'>Sell</a>\
                         <a href='#' class='stash' action='stash'>Stash</a>\
                    </div>\
                  </div>");  
    } else {
    // equippable
      for(var i in item.attributes) {
          atts = atts + "<p class='attribute'> + " + sepNum(item.attributes[i].toFixed(items.attributes[i].fixed)) + " " + items.attributes[i].name + "</p>";
      }
      for(var i in item.socketedWith) {
          socketedWith = socketedWith + "<div class='item itemtype"+item.socketedWith[i]+"'></div>";
      }
      if (socketedWith!='') {
          socketedWith = '<div class="sockets">'+socketedWith+"</div>";
      }
      var ritem = $("<div href='#' class='item itemquality"+item.quality+" \
                  itemtype"+item.type+"'>\
                    <div class='description'> \
                         <span class='title'>"+item.name+"</span> \
                         <p class='type'>["+ items.types[item.type] +"]</p> \
                         <p class='price'>Selling price: "+sepNum(item.price.toFixed(0))+" gold</p> \
                         " + atts + " \
                         <p class='type'>Sockets: "+ (item.sockets - item.openSockets) +"/"+item.sockets+"</p> \
                         " + socketedWith + " \
                         <a href='#' class='sell' action='sell'>Sell</a>\
                         <a href='#' class='stash' action='stash'>Stash</a>\
                         <a href='#' class='equip' action='equip'>Equip</a>\
                    </div>\
                  </div>");
    }
    return ritem;
  },
  checkButtons: function() {
    // Gamble Button
    var gcurrency = $("#gamblecurrency").val();
    if (gcurrency==0) {
      if (game.getGambleCost()[0] > game.data.character.gold)
        $('#gamble .gamble').addClass('disabled');
      else
        $('#gamble .gamble').removeClass('disabled');
    } else {
      if (game.getGambleCost()[1] > game.data.character.diamonds)
        $('#gamble .gamble').addClass('disabled');
      else
        $('#gamble .gamble').removeClass('disabled');
    }
    $("#gamblecurrency").change(function(){
      output.loadGamble();
    });
    
    // Building Buttons
    for (var id in buildings) {
       var price = game.getBuildingPrice(id);
       var currency = buildings[id].currency;
       var funded = game.data.buildings[id].funds;
       if (buildings[id].type==0) {
         if (currency == 0) {
           if (price>game.data.character.gold || funded>4) {
              $('#buildings .building'+id+' a.fund').addClass('disabled');
           } else {
              $('#buildings .building'+id+' a.fund').removeClass('disabled');
           }         
         } else {
           if (price>game.data.character.diamonds || funded>4) {
              $('#buildings .building'+id+' a.fund').addClass('disabled');
           } else {
              $('#buildings .building'+id+' a.fund').removeClass('disabled');
           }   
         }
       } else {
         if (currency == 0) {
           if (price>game.data.character.gold) {
              $('#buildings .building'+id+' a.fund').addClass('disabled');
           } else {
              $('#buildings .building'+id+' a.fund').removeClass('disabled');
           }         
         } else {
           if (price>game.data.character.diamonds) {
              $('#buildings .building'+id+' a.fund').addClass('disabled');
           } else {
              $('#buildings .building'+id+' a.fund').removeClass('disabled');
           }   
         }
       }
    }
    
    // Minion Buttons
    for (var id in minions) {
       var price = game.getMinionPrice(id);
       if (price>game.data.character.gold) {
          $('#minions .minion'+id+' a.buy').addClass('disabled');
       } else {
          $('#minions .minion'+id+' a.buy').removeClass('disabled');
       } 
       if (game.data.character.minions[id] == null || game.data.character.minions[id]<1) {
          $('#minions .minion'+id+' a.sell').addClass('disabled');
       } else {
          $('#minions .minion'+id+' a.sell').removeClass('disabled');
       }     
    }
    // Craft buttons 
    for (var id in game.data.stash) {
       if (game.data.stash[id].quality==10) {
          if (game.data.character.diamonds<game.data.stash[id].diamondsCost) {
             $('#stash .item[stashid='+id+'] a.craft').addClass('disabled');
          } else {
             $('#stash .item[stashid='+id+'] a.craft').removeClass('disabled');
          }
       }
    }
    for (var id in game.data.finds) {
       if (game.data.finds[id].quality==10) {
          if (game.data.character.diamonds<game.data.finds[id].diamondsCost) {
             $('#finds .item[findid='+id+'] a.craft').addClass('disabled');
          } else {
             $('#finds .item[findid='+id+'] a.craft').removeClass('disabled');
          }
       }
    }
  },
  loadOptions: function() {
    for (var id in game.data.options) {
      if (game.data.options[id]==1)
        $("#"+id).addClass('active');
    }
  },
  refreshStats: function() {
    game.data.stats.totalGold = game.data.stats.clickGold + game.data.stats.minedGold + game.data.stats.itemSoldGold;
    game.data.stats.totalDiamonds = game.data.stats.clickDiamonds + game.data.stats.minedDiamonds;
    for (var i in game.data.stats) {
      $('#'+(i+'')).html(sepNum(game.data.stats[i].toFixed(0)));
    }
  }
};