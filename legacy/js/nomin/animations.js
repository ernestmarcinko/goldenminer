var animations = new Object();

animations.startGold = function () {
  if (game.data.options.enableFancyAnim == 0) return;
  var j = 4;
  var i = 0
  var coins = $('#mines .goldcoin');
  game.data.goldAnimation = setInterval(function(){
      $(coins[j]).css("left", getRandom(49, 51)+"%");
      $(coins[j]).addClass('animated block fadeOutUp');
      $(coins[i]).removeClass('animated block fadeOutUp');
      $(coins[i]).css("left", "50%");
      i = (i>6)?0:++i;
      j = (j>6)?0:++j;
  }, 200); 
};

animations.stopGold = function () {
  clearInterval(game.data.goldAnimation);
};

animations.startDiamond = function () {
  if (game.data.options.enableFancyAnim == 0) return;
  var j = 4;
  var i = 0
  var coins = $('#mines .diamondcoin');
  game.data.diamondAnimation = setInterval(function(){
      $(coins[j]).css("left", getRandom(50, 52)+"%");
      $(coins[j]).addClass('animated block fadeOutUp');
      $(coins[i]).removeClass('animated block fadeOutUp');
      $(coins[i]).css("left", "51%");
      i = (i>6)?0:++i;
      j = (j>6)?0:++j;
  }, 180); 
};

animations.dropItem = function () {
  if (game.data.options.enableFancyAnim == 0) return;
  var item = ('<div class="item unidentified animated slow fadeInUp"></div>');
  item = $(item);
  $("#mines").append(item);
  setTimeout(function(){
     item.remove();
  }, 1000);
};

animations.dropGambled = function () {
  if (game.data.options.enableFancyAnim == 0) return;
  var item = ('<div class="item unidentified gambled animated slow fadeInUp"></div>');
  item = $(item);
  $("#equipment").append(item);
  setTimeout(function(){
     item.remove();
  }, 1000);
};

animations.pulse = function(item) {
  if (game.data.options.enableFancyAnim == 0) return;
  item.addClass('animated pulse');   
  setTimeout(function(){
    item.removeClass('animated pulse');
  }, 600);
};

animations.popGold = function(node) {
   if (game.data.options.enableFancyAnim == 0) return;
   var coin = $('<div class="goldcoin"></div>'); 
   coin.css({
      'top': node.offset().top - 16,
      'left': node.offset().left + (node.width()/2 - 5)
   });
   coin.addClass('animated block fadeOutUp');
   $("body").append(coin);
   setTimeout(function() {
      coin.remove();
   }, 600);
};

animations.mineClick = function(ce) {
   if (game.data.options.enableFancyAnim == 0) return;
   var e = ce || window.event;
   var coinAmount = game.data.character.goldPerSec * (game.data.character.clickEfficiency/100);
   var diamondAmount = game.data.character.diamondsPerSec * (game.data.character.clickEfficiency/100);
   var coin = $('<div class="goldcoin aw">+ '+coinAmount.toFixed(2)+'</div>');
   var diamond = $('<div class="diamondcoin aw">+ '+diamondAmount.toFixed(2)+'</div>'); 
   coin.css({
      'top': e.clientY - 33 + $(window).scrollTop(),
      'left': e.clientX - 5
   });
   diamond.css({
      'top': e.clientY - 16 + $(window).scrollTop(),
      'left': e.clientX - 5
   });
   coin.addClass('animated block fadeOutUpNospin');
   diamond.addClass('animated block fadeOutUpNospin');
   $("body").append(coin);
   $("body").append(diamond);
   setTimeout(function() {
      coin.remove();
      diamond.remove();
   }, 600);
};

animations.popText = function(text) {
   var msg = $('<div class="message">'+text+'</div>'); 
   msg.css({
      'bottom': "20%",
      'left': "50%"
   });
   $("body").append(msg);
   setTimeout(function() { 
      msg.addClass('animated block fadeOut');
   }, 1200);
   setTimeout(function() {
      msg.remove();
   }, 1800);
};

animations.stopDiamond = function () {
  clearInterval(game.data.diamondAnimation);
};