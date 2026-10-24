/**
 * Returns a random number between min and max
 */
function getRandom (min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min and max
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function isAroundXY (x, y, ux, uy, radius) {
    //console.log(x, y, ux, uy, Math.abs(ux-x)<=radius && Math.abs(uy-y)<=radius)
    return Math.abs(ux-(x+0))<=radius && Math.abs(uy-(y+0))<=radius; 
}

function isAround($node, ux, uy, radius) {
    return isAroundXY($node.offset().left, $node.offset().top, ux, uy, 20);
}

function sepNum(nStr) {
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ' ' + '$2');
	}
	return x1 + x2;
}

Object.defineProperty(Array.prototype, "prepend", {
  enumerable: false,
  configurable: false,
  writable: false,
  value: function(e) {
    this.unshift(e);
    return this;
 }
});

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second parm
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
}