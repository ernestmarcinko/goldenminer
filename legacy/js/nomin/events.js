var events = new Object();
events = {
  load: function () {
    events.heart();
    events.startStop();
    events.topButtons();
    events.sortStash();
    events.drinkAll();
    events.mineClick();
    events.leavePlanetClick();
    events.itemHover();
    events.itemEquip();
    events.itemStash();
    events.itemSell();
    events.itemCraft();
    events.itemDrink();
    events.itemsDbClick();
    events.itemsDrag();
    events.buildingFund();
    events.skillLearn();
    events.minionBuy();
    events.minionSell();
    events.options();
    events.gamble();
    events.dragging = false;
  },
  leavePlanetClick: function() {
    $('#leaveplanet').click(function(){
        var r=confirm("Leaving your current planet means you start on a new. Side effects from space travel may occur. Do you whish to proceed?");
          if (r==false) return;
        //game.newGame(0);
        game.data.character = planets[game.data.planet+1].charAttrs;
        game.data.planet++;
        game.data.finds = [];
        game.data.stash = [];
        for (var i in game.data.buildings) {
           game.data.buildings[i].funds = 0;
           game.data.buildings[i].timer = 0;
        }
        game.calcStats();
        game.autoSave();
        location.reload();
    });
  }, 
  heart: function() {
    $("#heart").click(function(e){
      if ($('#arrow_box').css('display')=='none') {
         $('#arrow_box').css({
          "display": "block",
          "top": $(this).offset().top - $(window).scrollTop() + $(this).outerWidth(true) + 10,
          "left": $(this).offset().left - $('#arrow_box').outerWidth(true)/2 + $(this).width()/2
         });
      } else {
         $('#arrow_box').css('display', 'none');
      }
    });
  },
  startStop: function() {
    $("a.mining").click(function(){
      if (game.isMining!=null) {
        game.stopMining();
        $(this).addClass('start');
        $(this).html("Start Mining!");
      } else {
        game.startMining();
        $(this).removeClass('start');
        $(this).html("Stop Mining!");      
      }
    });
    $(window).blur(function(){
      game.focus = false;
    });
    $(window).focus(function(){
      game.focus = true;
    });
  },
  topButtons: function() {
    $("#save").click(function(){
      game.autoSave();
    });
    $('#faqw .closeButton').click(function(){
       $('#moverlay').click();
    });
    $('#exsave .closeButton').click(function(){
       $('#moverlay').click();
    });
    $('#imsave .closeButton').click(function(){
       $('#moverlay').click();
    });
    $('#updatesw .closeButton').click(function(){
       $('#moverlay').click();
    });
    $('#reset').click(function(){
        var reset = confirm("All your progress and items will be lost. Do you really want to reset your game?");
        if (reset)
          game.hardReset();
    });
    $("#updates").click(function(){
      $('#moverlay').css('display', 'block');
      $("#updatesw").css('display', 'block');
    });
    $("#faq").click(function(){
      $('#moverlay').css('display', 'block');
      $("#faqw").css('display', 'block');
    });
    $("#esave").click(function(){
      game.autoSave();
      $('#moverlay').css('display', 'block');
      $("#exsave").css('display', 'block');
      var string = JSON.stringify(game.data);
      string =LZString.compressToBase64(string)
      $("#exsave textarea").val(string); 
    });
    $("#isave").click(function(){
      game.autoSave();
      $('#moverlay').css('display', 'block');
      $("#imsave").css('display', 'block'); 
    });
    $("#imsave .load").click(function(){
      var val = $("#imsave textarea").val();
      
      if (val.replace(/(\r\n|\n|\r)/gm,"")!='') {
        v = game.getValidatedSaveString(val);
        if (v!=null) {
          localStorage.setItem('gamedata', val);
          game.loadSavedGame();
          location.reload();
        }
      }                                     
      $('#moverlay').click();
    });
    $("a.minions").click(function(){
      $('a.buildings').removeClass('active');
      $('a.statistics').removeClass('active');
      $(this).addClass('active');
      $('#minions').css('display', 'block');
      $('#buildings').css('display', 'none');
      $('#statistics').css('display', 'none');
    });
    $("a.buildings").click(function(){
      $('a.minions').removeClass('active');
      $('a.statistics').removeClass('active');
      $(this).addClass('active');
      $('#minions').css('display', 'none');
      $('#buildings').css('display', 'block');
      $('#statistics').css('display', 'none');
    });
    $("a.statistics").click(function(){
      $('a.minions').removeClass('active');
      $('a.buildings').removeClass('active');
      $(this).addClass('active');
      $('#statistics').css('display', 'block');
      $('#minions').css('display', 'none');
      $('#buildings').css('display', 'none');
    });
  },
  sortStash: function() {
      $('#sort').click(function(e){
          e.preventDefault();
          if (game.data.stash.length == null || game.data.stash.length==0)
            return;
          game.stopMining();
          var order = $(this).attr('order');
          console.log(order);
          order = (order==0)?1:0;
          $(this).attr('order', order);
          $("#stash .content").append($("#stash .item").sort(function (a, b) {
            var stash = window.game.data.stash;
            var aStash = stash[$(a).attr("stashid")];
            var bStash = stash[$(b).attr("stashid")];
            if (order==1)
              return aStash.type - bStash.type;
            else
              return bStash.type - aStash.type;
          }));
          var i = game.data.stash.length - 1;
          var newStash = new Array();
          $("#stash .content .item").each(function(){
              visId = parseInt($(this).attr('stashid'));
              newStash[i] = ($.extend(true, {}, game.data.stash[visId]));
              i--;
          });
          game.data.stash = null;
          game.data.stash = newStash;
          output.loadStash();
          game.restartMining();
      });
  },
  drinkAll: function() {
      $('#drinkall').click(function(e){
          e.preventDefault();
          if (game.data.stash.length == null || game.data.stash.length==0)
            return;
          game.stopMining();
          var potionsLeft = true;
          while (potionsLeft) {
            if (game.data.stash.length<1) break;
            for (var i in game.data.stash) {
              if (game.data.stash[i].potionType!=null) {
                 game.drinkPotion(game.data.stash[i]);
                 game.data.stash.splice(i, 1);
                 potionsLeft = true;
                 break;
              }
              potionsLeft = false;
            }
          }
          game.restartMining();
          output.loadStash();
      });
  },
  mineClick: function() {
    $('#mines').click(function(e)  {
       var plusGold = game.data.character.goldPerSec * (game.data.character.clickEfficiency/100);
       var plusDiamonds = game.data.character.diamondsPerSec * (game.data.character.clickEfficiency/100);
       
       game.data.character.gold += plusGold;
       game.data.character.diamonds += plusDiamonds;
       
       game.data.stats.clickGold += plusGold;
       game.data.stats.clickDiamonds += plusDiamonds;
       
       animations.mineClick(e);
       if (game.data.isMining==null || game.data.isMining==0) {
          output.loadStats();
       }
       game.data.stats.clicks++;
    });
  },
  itemHover: function () {
    $(".third.last").on("hover", '.item', function(e){
       e.preventDefault();
    });
    $(".third.last").on("mouseover", '.item', function(e){
      if (events.dragging)  {
        $('#ifequipped').css({
          "display": "none"     
        }); 
        $(this).addClass('noScript');     
        return;
      } else {
        $(this).removeClass('noScript');
      }
      var top = 0;
      if (($(window).height() - 120 - ($(this).offset().top - $(window).scrollTop())) < $('.description', this).outerHeight(true)) {
         top = $(this).offset().top - $(window).scrollTop() - $('.description', this).outerHeight(true);
      } else {
         top = $(this).offset().top + 30 - $(window).scrollTop();
      }
      $('.description', this).css({
        "top": top,
        left: $(this).offset().left - 85,
      });
      if (output.ifEquipped($(this))!=null) {
        $('#ifequipped').css({
          "display": "block",
          "top": top,
          left: $('.description', this).offset().left - 228,      
        });
      }
    }); 
    $(".third.last").on("mouseout click", '.item', function(){
      $('#ifequipped').css({
        "display": "none"     
      });    
    }); 
  },
  itemEquip: function() {
    $(".third.last").on("click", '.item .equip', function(e){
      e.preventDefault();
      var parent = $(this).parent();
      while (!parent.hasClass("item")) {
        parent = parent.parent();
      }
      var id = $(parent).attr('findid');
    
      if (id==null || id=='') {
        //stashed item
        id = $(parent).attr('stashid');
        var item = game.data.stash[id];
        var hold = null;
        if(game.data.character.equipment[item.type]!=null)
          hold = game.data.character.equipment[item.type];
        game.data.character.equipment[item.type] = item;
        game.data.stash.splice(id, 1);
        if (hold!=null) {
          game.data.stash.push(hold);
        }
        $(parent).remove();
        var nlength = game.data.finds.length - 1;
        $("#stash .content .item").each(function(){
            $(this).attr('stashid', nlength);
            nlength = nlength - 1;
        });          
      } else {
        //found item
        var item = game.data.finds[id];
        if(game.data.character.equipment[item.type]!=null)
          game.data.stash.push(game.data.character.equipment[item.type]);
        game.data.character.equipment[item.type] = item;
        game.data.finds.splice(id, 1);
        $(parent).remove();
        var nlength = game.data.finds.length - 1;
        $("#finds .content .item").each(function(){
            $(this).attr('findid', nlength);
            nlength = nlength - 1;
        });
      }
      
      output.loadItems();
      game.calcStats();
      output.loadStats();
      output.loadSkills();
      output.loadMinions();
    });
  },
  itemStash: function() {
    $(".third.last").on("click", '.item .stash', function(e){
      e.preventDefault();
      var parent = $(this).parent();
      while (!parent.hasClass("item")) {
        parent = parent.parent();
      }
      var id = $(parent).attr('findid');
      if (id==null || id=='') {
        //equipped item
        id = $(parent).attr('eqid');
        var item = game.data.character.equipment[id];
        game.data.stash.push(item);
        game.data.character.equipment[id] = null; 
        $(parent).remove();
      } else {
        //found item
        var item = game.data.finds[id];
        game.data.stash.push(item);
        game.data.finds.splice(id, 1);
        $(parent).remove();
        var nlength = 0;
        $("#finds .content .item").each(function(){
            $(this).attr('findid', nlength);
            nlength++;
        });          
      }         
      output.loadStash();
      setTimeout(function(){
         animations.pulse($("#stash .item:last-child"));
      }, 200);
      game.calcStats();
      output.loadStats();
      output.loadSkills();
    });
  },
  itemSell: function() {
    $(".third.last").on("click", '.item', function(e){
      if(e.ctrlKey || e.altKey) {
        $(".sell", this).trigger("click");
      }
    });
    $(".third.last").on("click", '.item .sell', function(e){
      e.preventDefault();
      
      var parent = $(this).parent();
      
      while (!parent.hasClass("item")) {
        parent = parent.parent();
        
      }
      animations.popGold($(parent));
      
      var id = $(parent).attr('eqid');
      if (id!=null && id!='') {
        //equipped item
        var item = game.data.character.equipment[id];
        game.data.character.gold += item.price; 
        game.data.stats.itemSoldGold += item.price;
        game.data.stats.itemsSold++;
        game.data.character.equipment[id] = null; 
        $(parent).remove();
        //output.loadItems();
        game.calcStats();
        output.loadStats();
        output.loadSkills();
        output.loadSFCounters();
        return;
      } 
      
      id = $(parent).attr('findid');
      if (id!=null && id!='') {
        //found item
        var item = game.data.finds[id];
        game.data.character.gold += item.price; 
        game.data.stats.itemSoldGold += item.price;
        game.data.stats.itemsSold++;
        game.data.finds.splice(id, 1);
        $(parent).remove();
        var nlength = 0;
        $("#finds .content .item").each(function(){
            $(this).attr('findid', nlength);
            nlength++;
        }); 
        $(parent).remove();
        //output.loadItems();
        game.calcStats();
        output.loadStats();
        output.loadSkills();
        output.loadSFCounters();
        return;
      }           
    
      id = $(parent).attr('stashid');
      if (id!=null && id!='') {
        //stashed item
        var item = game.data.stash[id];
        game.data.character.gold += item.price; 
        game.data.stats.itemSoldGold += item.price;
        game.data.stats.itemsSold++;
        game.data.stash.splice(id, 1); 
        $(parent).remove();
        var nlength = 0;
        $("#stash .content .item").each(function(){
            $(this).attr('stashid', nlength);
            nlength++;
        }); 
        $(parent).remove(); 
        output.loadStash(); 
        game.calcStats();
        output.loadStats();
        output.loadSkills();
        output.loadSFCounters();
        return;
      } 
    });
      
  },
  itemCraft: function() {  
     $(".third.last").on("click", '.item .craft', function(e){
      e.preventDefault();
      var parent = $(this).parent();      
      while (!parent.hasClass("item")) {
        parent = parent.parent();
      }
      var id = $(parent).attr('findid');
      if (id!=null && id!='') {
        //found item
        var item = game.data.finds[id];
        if (game.data.character.diamonds<item.diamondsCost) return;
        game.data.character.diamonds -= item.diamondsCost; 
        game.data.finds.splice(id, 1);
        $(parent).remove();
        var nlength = 0;
        
        $("#finds .content .item").each(function(){
            $(this).attr('findid', nlength);
            nlength++;
        });
        game.craftItem(item.type);    
        game.calcStats();
        output.loadStats();
        return;
      }           
    
      id = $(parent).attr('stashid');
      if (id!=null && id!='') {
        //stashed item
        var item = game.data.stash[id];
        if (game.data.character.diamonds<item.diamondsCost) return;
        game.data.character.diamonds -= item.diamondsCost; 
        game.data.stash.splice(id, 1);
        $(parent).remove();
        var nlength = 0;
        $("#stash .content .item").each(function(){
            $(this).attr('stashid', nlength);
            nlength++;
        }); 
        game.craftItem(item.type);
        game.calcStats();
        output.loadStats();
        return;
      }
     });
  },
  
  itemDrink: function() {  
     $(".third.last").on("click", '.item .drink', function(e){
      e.preventDefault();
      var parent = $(this).parent();      
      while (!parent.hasClass("item")) {
        parent = parent.parent();
      }
      var id = $(parent).attr('findid');
      if (id!=null && id!='') {
        //found item
        var item = game.data.finds[id];
        game.drinkPotion(item);
        game.data.finds.splice(id, 1);
        $(parent).remove();                      
        var nlength = 0;
        
        $("#finds .content .item").each(function(){
            $(this).attr('findid', nlength);
            nlength++;
        });         
        game.data.stats.potionsDrinked++;
        game.calcStats();
        output.loadStats();
        return;
      }           
    
      id = $(parent).attr('stashid');
      if (id!=null && id!='') {
        //stashed item
        var item = game.data.stash[id];
        game.drinkPotion(item);
        game.data.stash.splice(id, 1);
        $(parent).remove();
        var nlength = 0;
        $("#stash .content .item").each(function(){
            $(this).attr('stashid', nlength);
            nlength++;
        }); 
        game.data.stats.potionsDrinked++;
        game.calcStats();
        output.loadStats();
        return;
      }
     });
  },
  
  itemsDbClick: function() {
     // Double click to consume a potion
     $(".third.last").on("dblclick", '.item', function(e) {
        e.preventDefault();
        var potion = $('.drink', this);
        if (potion.length>0)
          potion.trigger('click');
     });
  },
  
  itemsDrag: function() {
      $( "#stash .content" ).sortable({
            revert: 100,
            zIndex: 9999, 
            delay: 100,
            start: function( event, ui ) {
                //event.preventDefault();
                events.dragging = true;
                $( "#stash .content" ).css({
                  'overflow': 'visible',
                  'height' : 'auto'    
                });
                game.stopMining();
            },
            update: function( event, ui ) {
                events.dragging = false;
                $( "#stash .content" ).css({
                  'overflow-y':'auto',
                  'height': '162px !important'
                });
                var i = 0;
                var newStash = new Array();
                $("#stash .content .item").each(function(){
                    visId = parseInt($(this).attr('stashid'));
                    newStash[i] = ($.extend(true, {}, game.data.stash[visId]));
                    i++;
                });   
                game.data.stash = null;
                game.data.stash = newStash;
                /*var nlength = game.data.stash.length - 1;
                $("#stash .content .item").each(function(){
                    $(this).attr('stashid', nlength);
                    nlength = nlength - 1;
                });*/ 
                //game.restartMining();
                output.loadStash(); 
            },
            stop: function( event, ui ) { 
                events.dragging = false;
               // console.log(ui, event.pageX, event.pageY);
                var item = game.data.stash[$(ui.item).attr('stashid')];
                if (item.type>=100) {
                  // We are moving a gem!
                  // Let's see if its a socketing request
                  events.itemSocket($(ui.item).attr('stashid'), ui.offset.left+10, ui.offset.top+8);
                }
                game.restartMining();
            } 
      });
  },
  
  itemSocket: function(stashId, ux, uy) {
    if (isAround($("#eqarmor"), ux, uy, 20)) {
        game.insertGem(stashId, 1);
    } else if (isAround($("#eqhelm"), ux, uy, 20)) {
        game.insertGem(stashId, 2);
    } else if (isAround($("#eqweapon"), ux, uy, 20)) {
        game.insertGem(stashId, 0);
    } else if (isAround($("#eqring"), ux, uy, 20)) {
        game.insertGem(stashId, 3);
    } else if (isAround($("#eqamulet"), ux, uy, 20)) {
        game.insertGem(stashId, 4);
    }
  },
  
  buildingFund: function() {
    $('#buildings').on('click', 'a.fund', function(e){
        e.preventDefault();
        var i = $(this).attr('buildingid');
        var currency = buildings[i].currency;
        var price = game.getBuildingPrice(i);
        if (buildings[i].type==0) {
          //School
          if (game.data.buildings[i].funds>4) return;
          if (currency==0) {
            if (game.data.character.gold<price) return;
            game.data.character.gold -= price;
            if (game.data.buildings[i].funds==0) {
               game.data.buildings[i].timer = 1800;
            }
            game.data.buildings[i].funds++;
          } else {
            if (game.data.character.diamonds<price) return;
            game.data.character.diamonds -= price;
            if (game.data.buildings[i].funds==0) {
               game.data.buildings[i].timer = 1800;
            }
            game.data.buildings[i].funds++;        
          }
        } else {
          if (currency==0) {
            if (game.data.character.gold<price) return;
            game.data.character.gold -= price;
            game.data.buildings[i].funds++;
          } else {
            if (game.data.character.diamonds<price) return;
            game.data.character.diamonds -= price;
            game.data.buildings[i].funds++;        
          }
        }
        game.calcStats();
        output.loadStats();
        animations.popGold($(this));
        output.refreshBuildings();
    });
  },
  
  skillLearn: function() {
    $("#skills").on("click", "a.learn", function(){
        if(game.data.character.skill<=0) return;
        var id = $(this).attr("skillid");
        game.data.character.skill -= 1;
        game.data.character["initial_"+id] += 1;
        game.calcStats();
        output.loadStats();
        output.loadSkills();
    });     
  },
  minionBuy: function() {
    $("#minions").on("click", "a.buy", function(e){
       e.preventDefault();
       var id = $(this).attr("minionid");
       var price = game.getMinionPrice(id);
       if (price<=game.data.character.gold) {
          game.data.character.gold -= price;
          if (game.data.character.minions[id]==null)
            game.data.character.minions[id] = 1;
          else
            game.data.character.minions[id]++;
          animations.popGold($(this));
          output.loadMinions();
          game.calcStats();
          output.loadStats();
       } 
    });  
  },
  minionSell: function() {
    $("#minions").on("click", "a.sell", function(e){
       return; // TBR 0.30
       e.preventDefault();
       var id = $(this).attr("minionid");
       if (game.data.character.minions[id] == null) return;
       var price = (minions[id].price / 2).toFixed(0);
       game.data.character.gold += minions[id].price;
       if (game.data.character.minions[id]==1)
        game.data.character.minions[id] = null;
       else
        game.data.character.minions[id]--;
       animations.popGold($(this));
       output.loadMinions();
       game.calcStats();
       output.loadStats();
    });
  }, 
  gamble: function() {
   $("#gamble a.gamble").click(function() {
      var gambleCost = game.getGambleCost();
      var currency = $('#gamblecurrency').val();
      if (currency==0) {
        if (gambleCost[0] > game.data.character.gold) return;
        game.data.character.gold -= gambleCost[0];
        game.dropItem(parseInt($('#gambleitem').val()), true);
      } else {
        if (gambleCost[1] > game.data.character.diamonds) return;
        game.data.character.diamonds -= gambleCost[1];
        game.dropItem(parseInt($('#gambleitem').val()), true);      
      }
      output.loadGamble();
   });
  },
  options: function() {
    $('#moverlay').click(function(){
      $(this).css('display', 'none');
      $("#moptions").css('display', 'none');
      $("#exsave").css('display', 'none');
      $("#imsave").css('display', 'none');
      $("#faqw").css('display', 'none');
      $("#updatesw").css('display', 'none');
    });
    $('#moptions .closeButton').click(function(){
       $('#moverlay').click();
    });
    $('a.moptions').click(function(){
      $('#moverlay').css('display', 'block');
      $("#moptions").css('display', 'block');    
    });
    $("#moptions").on("click", 'div.onOffInner', function(){
       var id = $(this).attr("id");
       var val = (game.data.options[id]==1)?0:1;
       game.data.options[id] = val;
       if (val==1)
        $('#'+id).addClass('active');
       else
        $('#'+id).removeClass('active');
       if (id='enableFancyAnim') {
        if (val==1) {
          animations.startGold();
          animations.startDiamond();
        } else {
          animations.stopGold();
          animations.stopDiamond();        
        }
       }
    });
  }
};