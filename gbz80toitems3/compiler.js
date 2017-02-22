
'use strict';


var hexits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
function hexToDec(hex) {
	var dec = 0;
	var n = hex.length;
	
	for(var i = 0; i < n; i++) {
		var hexitDec = hexits.indexOf(hex[i]);
		if(hexitDec == -1) {
			throw new SyntaxError('Invalid hexadecimal ' + hex);
		}
		
		dec = dec * 16 + hexitDec;
	}
	
	return dec;
}

function decToHex(dec) {
	var hex = '';
	
	while(dec || hex.length < 2) {
		hex = hexits[dec % 16] + hex;
		dec = Math.floor(dec / 16);
	}
	
	return hex;
}

function binToDec(bin) {
	var dec = 0;
	var n = bin.length;
	
	for(var i = 0; i < n; i++) {
		dec *= 2;
		
		if(bin[i] == '1') {
			dec++;
		} else if(bin[i] != '0') {
			throw new SyntaxError('Invalid binary ' + bin);
		}
	}
	
	return dec;
}

var regHex = /^(\$|hex::?|0x)?([0-9A-Fa-f]+)(h|H)?$/;
function parseHex(str) {
	if(typeof str != 'string') {
		throw new TypeError('Expected a string !');
	}
	
	// We need either a prefix or a suffix, but not both.
	if(str.match(regHex) && (RegExp.$1 != '') != (RegExp.$3 != '')) {
		return hexToDec(RegExp.$2);
	} else {
		return NaN;
	}
}

var regBin = /^(%|bin::?|0b)?([01]+)(b|B)?$/;
function parseBin(str) {
	if(typeof str != 'string') {
		throw new TypeError('Expected a string !');
	}
	
	// We need either a prefix or a suffix, but not both.
	if(str.match(regBin) && (RegExp.$1 != '') != (RegExp.$3 != '')) {
		return binToDec(RegExp.$2);
	} else {
		return NaN;
	}
}


var byteStream = [], currentGlobalLabel = '';
var reg8  = ['b', 'c', 'd', 'e', 'h', 'l', '(hl)', 'a'];
var reg16 = ['bc', 'de', 'hl', 'af'];
var conds = ['nz', 'z', 'nc', 'c'];

function readByte(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('Only one operand expected to readByte !');
	} else if(operand[0] == '') {
		throw new SyntaxError('Empty operand given !');
	}
	
	operand = operand[0];
	var number = operand;
	if(operand.match(/^\d+$/)) {
		// Decimal
		number = parseInt(operand);
	} else if(operand.match(regHex)) {
		// Hex
		number = parseHex(operand);
	} else if(operand.match(regBin)) {
		// Bin
		number = parseBin(operand);
	} else if(typeof operand == 'string') {
		// Label
		byteStream.push({size: 1, name: operand, isLabel: 0});
		return 1;
	} else {
		throw new SyntaxError('Invalid operand passed to readByte !');
	}
	
	if(number < 0 || number > 256) {
		throw new SyntaxError(operand + ' is not a 8-bit number !');
	} else {
		byteStream.push(number);
	}
	
	return 1;
}

function readWord(operand) { // TODO
	if(operand.length != 1) {
		throw new SyntaxError('Only one operand expected to readWord !');
	} else if(operand[0] == '') {
		throw new SyntaxError('Empty operand given !');
	}
	
	operand = operand[0];
	var number = operand;
	if(operand.match(/^\d+$/)) {
		// Decimal
		number = parseInt(operand);
	} else if(operand.match(regHex)) {
		// Hexadecimal
		number = parseHex(operand);
	} else if(operand.match(regBin)) {
		// Binary
		number = parseBin(operand);
	} else if(typeof operand == 'string') {
		// Label
		byteStream.push({size: 2, name: operand, isLabel: 0});
		return 1;
	} else {
		throw new SyntaxError('Invalid operand passed to readWord !');
	}
	
	if(number < 0 || number > 256) {
		throw new SyntaxError(operand + ' is not a 16-bit number !');
	} else {
		byteStream.push(number % 256);
		byteStream.push(Math.floor(number / 256));
	}
	
	return 2;
}

function determineLdType(operand) { // TODO
	if(operand.length != 2) {
		throw new SyntaxError('ld needs two operands !');
	}
	
	var target = reg8.indexOf(operand[0]);
	var dest;
	if(target != -1) {
		// Check for a reg8 target.
		dest = reg8.indexOf(operand[1]);
		if(dest != -1) {
			// That's reg8 to reg8. The easy one.
			
			byteStream.push(64 + target * 8 + dest);
			return 1;
		} else if(target == 7 && operand[1][0] == '(' && operand[1][operand[1].length - 1] == ')') {
			// A memory load to a.
			if(operand[1] == '(bc)') {
				// ld a, (bc)
				
				byteStream.push(10);
				return 1;
			} else if(operand[1] == '(de)') {
				// ld a, (de)
				
				byteStream.push(26);
				return 1;
			} else if(operand[1] == '(hli)') {
				
				byteStream.push(42);
				return 1;
			} else if(operand[1] == '(hld)') {
				
				byteStream.push(58);
				return 1;
			} else {
				// ld a, (mem16)
				
				byteStream.push(250);
				readWord([operand[1]]);
				return 3;
			}
			
		} else {
			// Assume an immediate load.
			byteStream.push(6 + target * 8);
			readByte([operand(1)]);
			
			return 2;
		}
		
	} else if(operand[1] == 'a') {
		// Memory load from a
		if(operand[0] == '(bc)') {
			
			byteStream.push(2);
			return 1;
		} else if(operand[0] == '(de)') {
			
			byteStream.push(18);
			return 1;
		} else if(operand[0] == '(hli)') {
			
			byteStream.push(34);
			return 1;
		} else if(operand[0] =='(hld)') {
			
			byteStream.push(50);
			return 1;
		} else {
			// ld (mem16), a
			
			byteStream.push(234);
			readWord([operand[0]]);
			return 3;
		}
	} else if(operand[0] == 'bc') {
		// ld bc, imm16
		
		byteStream.push(1);
		readWord([operand[1]]);
		return 3;
	} else if(operand[0] == 'de') {
		// ld de, imm16
		
		byteStream.push(17);
		readWord([operand[1]]);
		return 3;
	}
}

function determineLdiType(operand) {
	if(operand[0] == 'a' && operand[1] == '(hl)') {
		byteStream.push(42);
	} else if(operand[0] == '(hl)' && operand[1] == 'a') {
		byteStream.push(34);
	} else {
		throw new SyntaxError('Invalid use of ldi ! Either "ldi (hl), a" or "ldi a, (hl)" are valid.');
	}
	
	return 1;
}

function determineLddType(operand) {
	if(operand[0] == 'a' && operand[1] == '(hl)') {
		byteStream.push(58);
	} else if(operand[0] == '(hl)' && operand[1] == 'a') {
		byteStream.push(50);
	} else {
		throw new SyntaxError('Invalid use of ldd ! Either "ldd (hl), a" or "ldd a, (hl)" are valid.');
	}
	
	return 1;
}

function determineLdhType(operand) {
	var isLoadFromMem = operand[0] == 'a';
	var memAccess = operand[isLoadFromMem];
	if(memAccess.match(/^\(((\$|hex::?|0x)?[fF][fF]00(h|H)?\s+\+\s+)?c\)$/) || memAccess == '(c)') {
		if(isLoadFromMem) {
			throw new SyntaxError('Invalid operand to ldh !');
		}
		
		// ldh ($FF00 + c), a
		byteStream.push(226);
		return 1;
	} else {
		byteStream.push(224 + isLoadFromMem * 16);
		readByte([operand[1]]);
		return 2;
	}
}

function determineAddType(operand) {
	if(operand.length != 2) {
		try {
			// Try to read a "add imm8", and but throw an operand error if it fails
			if(operand.length != 1) {
				throw new SyntaxError('Welp, at least I tried being lenient.');
			}
			
			byteStream.push(198);
			readByte(operand);
			return 2;
			
		} catch(err) {
			throw new SyntaxError('add takes exactly 2 operands !');
		}
	}
	
	var reg2;
	if(operand[0] == 'hl') {
		reg2 = reg16.indexOf(operand[1]);
		if(reg2 == -1) {
			throw new SyntaxError('add hl, reg16 expects a 16-bit register as second argument, but ' + operand[1] + ' obtained.');
		}
		
		byteStream.push(reg2 * 16 + 9);
		return 1;
		
	} else if(operand[0] == 'a') {
		reg2 = reg8.indexOf(operand[1]);
		if(reg2 == -1) {
			// Immediate add
			byteStream.push(198);
			readByte(operand.slice(1));
			return 2;
		}
		
		byteStream.push(128 + reg2);
		return 1;
	} else {
		throw new SyntaxError('add can only have a or hl as target !');
	}
}

function determineAdcType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new SyntaxError('adc takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new SyntaxError('Only possible target for adc is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(136 + sourceID);
		return 1;
	} else {
		byteStream.push(206);
		readByte([source]);
		return 2;
	}
}

function determineSubType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new SyntaxError('sub takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new SyntaxError('Only possible target for sub is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(144 + sourceID);
		return 1;
	} else {
		byteStream.push(214);
		readByte([source]);
		return 2;
	}
}

function determineSbcType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new SyntaxError('sbc takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new SyntaxError('Only possible target for sbc is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(152 + sourceID);
		return 1;
	} else {
		byteStream.push(222);
		readByte([operand[1]]);
		return 2;
	}
}

function determineIncType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('inc takes exactly one argument !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(4 + reg * 8);
		return 1;
	}
	
	reg = reg16.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(3 + reg * 16);
		return 1;
	}
	
	if(operand[0] == 'sp') {
		byteStream.push(51);
		return 1;
	} else {
		throw new SyntaxError('Expected a reg8, reg16 or sp as operand for inc, but got \'' + operand + '\'')
	}
}

function determineDecType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('dec takes exactly one argument !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(5 + reg * 8);
		return 1;
	}
	
	reg = reg16.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(11 + reg * 16);
		return 1;
	}
	
	if(operand[0] == 'sp') {
		byteStream.push(59);
		return 1;
	} else {
		throw new SyntaxError('Expected a reg8, reg16 or sp as operand for dec, but got \'' + operand + '\'')
	}
}

function determineAndType(operand) {
	determineSubType(operand);
	byteStream[byteStream.length - 1] += 16;
}

function determineOrType(operand) {
	determineSubType(operand);
	byteStream[byteStream.length - 1] += 32;
}

function determineXorType(operand) {
	determineSubType(operand);
	byteStream[byteStream.length - 1] += 24;
}

function determineCpType(operand) {
	determineSubType(operand);
	byteStream[byteStream.length - 1] += 40;
}

function determineJrTypeAndDest(operand) {
	if(operand.length == 1) {
		operand.push(operand[0]);
		byteStream.push(24);
	} else if(operand.length == 2) {
		var cond = conditionals.indexOf(operand[0]);
		if(cond == -1) {
			throw new SyntaxError('Invalid condition for jr !');
		}
		
		byteStream.push(32 + cond * 8);
	} else {
		throw new SyntaxError('Invalid operands to jr ! ');
	}
	
	byteStream.push({size: 2, name: operand[1], isLabel: 1});
	return 2;
}

function determineJpTypeAndDest(operand) {
	if(operand.length == 1) {
		if(operand[0] == 'hl' || operand[0] == '(hl)') {
			// jp (hl)
			byteStream.push(233);
			return 1;
		}
		
		operand.push(operand[0]);
		byteStream.push(195);
	} else if(operand.length == 2) {
		var cond = conditionals.indexOf(operand[0]);
		if(cond == -1) {
			throw new SyntaxError('Invalid condition for jp !');
		}
		
		byteStream.push(194 + cond * 8);
	} else {
		throw new SyntaxError('Invalid operands to jp ! ');
	}
	
	if(typeof operand[1] == 'string') {
		byteStream.push({size: 2, name: operand[1], isLabel: 1});
		byteStream.push(0); // Filler for address replacement
	} else {
		byteStream.push(operand[1] % 256);
		byteStream.push(Math.floor(operand[1] / 256));
	}
	
	return 3;
}

function determineCallTypeAndDest(operand) {
	if(operand.length == 1) {
		operand.push(operand[0]);
		byteStream.push(197);
	} else if(operand.length == 2) {
		var cond = conditionals.indexOf(operand[0]);
		if(cond == -1) {
			throw new SyntaxError('Invalid condition for call !');
		}
		
		byteStream.push(196 + cond * 8);
	} else {
		throw new SyntaxError('Invalid operands to call ! ');
	}
	
	if(typeof operand[1] == 'string') {
		byteStream.push(operand[1]);
		byteStream.push(0); // Filler for address replacement
	} else {
		byteStream.push(operand[1] % 256);
		byteStream.push(Math.floor(operand[1] / 256));
	}
	
	return 3;
}

function determineRetType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('ret takes only one operand !');
	}
	
	if(operand[0] == '') {
		byteStream.push(201);
	} else {
		var condOfs = conds.indexOf(operand[0]);
		if(condOfs == -1) {
			throw new SyntaxError('ret takes one of the following conditionals : nz, z, nc, or c');
		}
		
		byteStream.push(192 + condOfs * 8);
	}
	return 1;
}

function determineRstDestination(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('rst takes exactly one operand !');
	} else if(!operand[0].match(/^[0-3][08]h$/)) {
		throw new SyntaxError('rst vector must be of 00h, 08h, 10h, 18h, 20h, 28h, 30h, or 38h !');
	}
	
	byteStream.push(199 + parseHex(operand[0]));
	return 1;
}

function determinePushType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('push takes exactly one operand !');
	}
	
	var reg = reg16.indexOf(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('push : unknown operand ' + operand[0] + ' (expected bc, de, hl or af)');
	}
	
	byteStream.push(197 + reg * 16);
	return 1;
}

function determinePopType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('pop takes exactly one operand !');
	}
	
	var reg = reg16.indexOf(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('pop : unknown operand ' + operand[0] + ' (expected bc, de, hl or af)');
	}
	
	byteStream.push(193 + reg * 16);
	return 1;
}

function placeNop(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('nop takes no operands !');
	}
	
	byteStream.push(0);
	return 1;
}

function placeScf(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('scf takes no operands !');
	}
	
	byteStream.push(55);
	return 1;
}

function placeCcf(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('ccf takes no operands !');
	}
	
	byteStream.push(63);
	return 1;
}

function placeCpl(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('cpl takes no operands !');
	}
	
	byteStream.push(47);
	return 1;
}

function placeDaa(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('daa takes no operands !');
	}
	
	byteStream.push(39);
	return 1;
}

function placeRla(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('rla takes no operands !');
	}
	
	byteStream.push(23);
	return 1;
}

function placeRra(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('rra takes no operands !');
	}
	
	byteStream.push(31);
	return 1;
}

function placeRlca(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('rlca takes no operands !');
	}
	
	byteStream.push(7);
	return 1;
}

function placeRrca(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('rrca takes no operands !');
	}
	
	byteStream.push(15);
	return 1;
}

function determineRlcType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('rlc takes only one operand !');
	}
	
	var reg = reg8.indexof(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('rlc\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(reg8);
	return 2;
}

function determineRrcType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('rrc takes only one operand !');
	}
	
	var reg = reg8.indexof(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('rrc\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(8 + reg8);
	return 2;
}

function determineRlType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('rl takes only one operand !');
	}
	
	var reg = reg8.indexof(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('rl\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(16 + reg8);
	return 2;
}

function determineRrType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('rr takes only one operand !');
	}
	
	var reg = reg8.indexof(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('rr\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(24 + reg8);
	return 2;
}

function determineSlaType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('sla takes only one operand !');
	}
	
	var reg = reg8.indexof(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('sla\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(32 + reg8);
	return 2;
}

function determineSraType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('sra takes only one operand !');
	}
	
	var reg = reg8.indexof(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('sra\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(40 + reg8);
	return 2;
}

function determineSwapType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('swap takes only one operand !');
	}
	
	var reg = reg8.indexof(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('swap\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(48 + reg8);
	return 2;
}

function determineSrlType(operand) {
	if(operand.length != 1) {
		throw new SyntaxError('srl takes only one operand !');
	}
	
	var reg = reg8.indexof(operand[0]);
	if(reg == -1) {
		throw new SyntaxError('srl\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(56 + reg8);
	return 2;
}

function determineBitType(operand) {
	if(operand.length != 2) {
		throw new SyntaxError('bit takes exactly two operands !');
	}
	
	var bit = parseInt(operand[0]);
	if(isNaN(bit) || bit < 0 || bit > 7) {
		throw new SyntaxError('bit\'s first operand must be a number in range 0 - 7 (inclusive) !');
	}
	
	var reg = reg8.indexOf(operand[1]);
	if(reg == -1) {
		throw new SyntaxError('bit\'s second operand must be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(64 + bit * 8 + reg);
	return 2;
}

function determineResType(operand) {
	if(operand.length != 2) {
		throw new SyntaxError('res takes exactly two operands !');
	}
	
	var bit = parseInt(operand[0]);
	if(isNaN(bit) || bit < 0 || bit > 7) {
		throw new SyntaxError('res\'s first operand must be a number in range 0 - 7 (inclusive) !');
	}
	
	var reg = reg8.indexOf(operand[1]);
	if(reg == -1) {
		throw new SyntaxError('res\'s second operand must be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(128 + bit * 8 + reg);
	return 2;
}

function determineSetType(operand) {
	if(operand.length != 2) {
		throw new SyntaxError('set takes exactly two operands !');
	}
	
	var bit = parseInt(operand[0]);
	if(isNaN(bit) || bit < 0 || bit > 7) {
		throw new SyntaxError('set\'s first operand must be a number in range 0 - 7 (inclusive) !');
	}
	
	var reg = reg8.indexOf(operand[1]);
	if(reg == -1) {
		throw new SyntaxError('set\'s second operand must be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(196 + bit * 8 + reg);
	return 2;
}

function placeHalt(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('nop takes no operands !');
	}
	
	byteStream.push(118);
	return 1;
}

function placeStop(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('nop takes no operands !');
	}
	
	byteStream.push(16);
	byteStream.push(0);
	return 2;
}

function placeEi(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('nop takes no operands !');
	}
	
	byteStream.push(251);
	return 1;
}

function placeDi(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('nop takes no operands !');
	}
	
	byteStream.push(243);
	return 1;
}

function placeReti(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new SyntaxError('nop takes no operands !');
	}
	
	byteStream.push(217);
	return 1;
}

var instructions = [{name: 'db', func: readByte}, {name: 'dw', func: readWord},
					{name: 'ld', func: determineLdType}, {name: 'ldi', func: determineLdiType}, {name: 'ldd', func: determineLddType}, {name: 'ldh', func: determineLdhType},
					{name: 'add', func: determineAddType}, {name: 'adc', func: determineAdcType}, {name: 'sub', func: determineSubType}, {name: 'sbc', func: determineSbcType},
					{name: 'inc', func: determineIncType}, {name: 'dec', func: determineDecType},
					{name: 'and', func: determineAndType}, {name: 'or', func: determineOrType}, {name: 'xor', func: determineXorType}, {name: 'cp', func: determineCpType},
					{name: 'jr', func: determineJrTypeAndDest}, {name: 'jp', func: determineJpTypeAndDest},
					{name: 'call', func: determineCallTypeAndDest}, {name: 'ret', func: determineRetType}, {name: 'rst', func: determineRstDestination},
					{name: 'push', func: determinePushType}, {name: 'pop', func: determinePopType},
					{name: 'nop', func: placeNop},
					{name: 'scf', func: placeScf}, {name: 'ccf', func: placeCcf}, {name: 'cpl', func: placeCpl}, {name: 'daa', func: placeDaa},
					{name: 'rla', func: placeRla}, {name: 'rra', func: placeRra}, {name: 'rlca', func: placeRlca}, {name: 'rrca', func: placeRrca},
					{name: 'rlc', func: determineRlcType}, {name: 'rrc', func: determineRrcType}, {name: 'rl', func: determineRlType}, {name: 'rr', func: determineRrType},
						{name: 'swap', func: determineSwapType}, {name: 'srl', func: determineSrlType}, {name: 'sla', func: determineSlaType}, {name: 'sra', func: determineSraType},
					{name: 'bit', func: determineBitType}, {name: 'res', func: determineResType}, {name: 'set', func: determineSetType},
					{name: 'halt', func: placeHalt}, {name: 'stop', func: placeStop},
					{name: 'ei', func: placeEi}, {name: 'di', func: placeDi},
					{name: 'reti', func: placeReti}];

var items = [
		"#j.",
		"Master Ball",
		"Ultra Ball",
		"Great Ball",
		"Pok&eacute; Ball",
		"Town Map",
		"Bicycle",
		"????? (\"Surfboard\")",
		"Safari Ball",
		"Pok&eacute;dex",
		"Moon Stone",
		"Antidote",
		"Burn Heal",
		"Ice Heal",
		"Awakening",
		"Parlyz Heal",
		"Full Restore",
		"Max Potion",
		"Hyper Potion",
		"Super Potion",
		"Potion",
		"Boulder Badge",
		"Cascade Badge",
		"Thunder Badge",
		"Rainbow Badge",
		"Soul Badge",
		"Marsh Badge",
		"Volcano Badge",
		"Earth Badge",
		"Escape Rope",
		"Repel",
		"Old Amber",
		"Fire Stone",
		"Thunderstone",
		"Water Stone",
		"HP Up",
		"Protein",
		"Iron",
		"Carbos",
		"Calcuim",
		"Rare Candy",
		"Dome Fossil",
		"Helix Fossil",
		"Secret Key",
		"????? (Unusable)",
		"Bike Voucher",
		"X Accuracy",
		"Leaf Stone",
		"Card Key",
		"Nugget",
		"PP Up (useless)",
		"Pok&eacute; Doll",
		"Full Heal",
		"Revive",
		"Max Revive",
		"Guard Spec.",
		"Super Repel",
		"Max Repel",
		"Dire Hit",
		"Coin",
		"Fresh Water",
		"Soda Pop",
		"Lemonade",
		"S.S. Ticket",
		"Gold Teeth",
		"X Attack",
		"X Defense",
		"X Speed",
		"X Special",
		"Coin Case",
		"Oak's Parcel",
		"Item Finder",
		"Silph Scope",
		"Poke Flute",
		"Lift Key",
		"Exp. All",
		"Old Rod",
		"Good Rod",
		"Super Rod",
		"PP Up",
		"Ether",
		"Max Ether",
		"Elixer",
		"Max Elixer",
		"B2F",
		"B1F",
		"1F",
		"2F",
		"3F",
		"4F",
		"5F",
		"6F",
		"7F",
		"8F",
		"9F",
		"10F",
		"11F",
		"B4F",
		"w #m#",
		"ws# #m#",
		"v# #t#m#",
		"#'#d#m#",
		"#m#",
		"w 'l#m#",
		"#f#m#",
		"#m#",
		"#-g##m#",
		"#",
		"&eacute;",
		"#il#",
		"Lg#-",
		"#-g#",
		"#QGnS#I",
		"Gn#SI",
		"#Q;MP-",
		"MP-",
		"T4 89 ゥ N",
		"ぅ",
		"####",
		"4",
		"",
		"$ ぅ",
		"4 “",
		"ぉ8#",
		"8# 8",
		"# $ $ぅ#######",
		"## ## ## A# ?##",
		"#(player) #7#####6####7#### ",
		"#PC#",
		"4# #4# y PC……4# ぅ4# H# ",
		"4# #",
		":### ##pゥ# #(rival)#E ## ",
		"Trade completed!",
		"Too bad! The trade w",
		"#",
		"####PkMnぉゥ# #ゥ #ゥC ## ",
		"#▶D#",
		"##E#",
		"## O #B## ##p’t’u’v",
		"TRADE CENTER",
		" 	p’é## #### ### Enemy #SROCKE",
		"#a #### #### #######",
		"8##",
		"BATTLE ANIMATION",
		"BATTLE STYLE",
		"CANCEL",
		"#WA4# #z####3#",
		"#—##2pゥ",
		"# E###tE#",
		"##F#",
		"##F#",
		"#XF#",
		"#CC###’### ####♀ POKéi6",
		"POKéTRAINER#: ###",
		"#ァ pゥ #ゥ# WF # 't",
		"###v ##",
		"#ゥ p#ゥ ##ゥL ぅH #4ゥ",
		"#Q r# 4ァ h ェエ##",
		"4# 8# 4# 8# #H#####",
		"ABCDEFGHIJKLMNOPQRST",
		"ェエ#ゥァ # ##########",
		"###2#u 4# ##Vh####V",
		"RIVAL's",
		"NAME?",
		"NICKNAME?",
		"#S#iS MS4# h###.S",
		"#♂ ## ##ぃ## eC##V",
		"#S#'tS MS4# h####L",
		"#▼ ## ## A## eC#!V",
		"#a ##— ### ## #: #",
		"NEW NAME",
		"NEW NAME",
		"##",
		"#5ぉz##—#.CL#: ##",
		"RED/BLUE",
		"ASH/GARY",
		"JACK/JOHN",
		"NEW NAME",
		"BLUE/RED",
		"GARY/ASH",
		"JOHN/JACK",
		"",
		"## #]9## O# # #b9##]",
		"##G#",
		"##G#",
		"#(rival)G#",
		"#‘G#",
		"#QG#",
		"#oG#",
		"# G#",
		"#$G#",
		"##H#",
		"##H#",
		"##4S #v é##: ## ##",
		"#",
		"H#",
		"HM01",
		"HM02",
		"HM03",
		"HM04",
		"HM05",
		"TM01",
		"TM02",
		"TM03",
		"TM04",
		"TM05",
		"TM06",
		"TM07",
		"TM08",
		"TM09",
		"TM10",
		"TM11",
		"TM12",
		"TM13",
		"TM14",
		"TM15",
		"TM16",
		"TM17",
		"TM18",
		"TM19",
		"TM20",
		"TM21",
		"TM22",
		"TM23",
		"TM24",
		"TM25",
		"TM26",
		"TM27",
		"TM28",
		"TM29",
		"TM30",
		"TM31",
		"TM32",
		"TM33",
		"TM34",
		"TM35",
		"TM36",
		"TM37",
		"TM38",
		"TM39",
		"TM40",
		"TM41",
		"TM42",
		"TM43",
		"TM44",
		"TM45",
		"TM46",
		"TM47",
		"TM48",
		"TM49",
		"TM50",
		"TM51",
		"TM52",
		"TM53",
		"TM54",
		"CANCEL"];
var attribs = [
        {used: false, valid: false, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty:true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: false}];
function compile(evt) {
	evt.preventDefault();
	
	$('#dismissError').trigger('click');
	
	
	var lines = document.getElementById('code').innerText.split('\n');
	var n = lines.length, i, lineNums = [];
	
	for(i = 1; i < n; i++) {
		lineNums.push('' + i);
	}
	$('#lineNumbers').html(lineNums.join('<br/>')).removeClass('hidden');
	
	var labels = [];
	currentGlobalLabel = '';
	function getLabelOffset(labelName) {
		var labelOffset = -1;
		labels.forEach(function(label) {
			if(label.name == b) {
				labelOffset = label;
			}
		});
		
		if(labelOffset == -1) {
			throw new ReferenceError('Line ' + i + ' : Unknown label \'' + b + '\'');
		}
		return labelOffset;
	}
	
	try {
		var offset = hexToDec($('#baseOffset').val().toLowerCase());
	} catch(err) {
		throw new TypeError('Failed to parse Base offset : ' + err.message);
	}
	var baseOffset = offset;
	
	
	/** BEGIN ASSEMBLER **/
	
	// Flush the byte stream
	byteStream = [];
	
	for(i = 0; i < n; ) {
		lines[i].search(/\[(.+)\]/);
		var pieces = lines[i].toLowerCase()
							 .replace('[', '(').replace(']', ')') // Braces will be parsed the same as parentheses. Note that "ld [hl), 1" becomes valid...whatever.
							 .trim() // Trim to make sure the first character is wordy
							 .split(';')[0] // Get the part before the comment,
							 .split(/\s+/); // And split each part, allowing each to be separated by any "white" characters
		var instrName = pieces[0]; // Get the instruction name
		var operands = pieces.slice(1).join('').split(','); // Get the operand part
		
		i++;
		
		if(instrName != '') { // If the line contains nothing, don't process it
			
			if(instrName[0] == '.') {
				// Local label
				// Name will be in format "Global.Local"
				instrName = instrName.trim();
				if(instrName.slice(1) == '') {
					throw new SyntaxError('Line ' + i + ' : Empty label name !');
				}
				
				if(labels.indexOf(currentGlobalLabel + instrName) != -1) {
					throw new SyntaxError('Line ' + i + ' : Duplicate label ' + currentGlobalLabel + instrName);
				}
				labels.push({name: currentGlobalLabel + instrName, offset: offset});
				
			} else if(instrName.indexOf(':') != -1) {
				// Global label
				instrName = instrName.replace(':', '').replace(':', '').trim();
				if(instrName == '') {
					throw new SyntaxError('Line ' + i + ' : Empty label name !');
				}
				
				if(labels.indexOf(instrName) != -1) {
					throw new SyntaxError('Line ' + i + ' : Duplicate label ' + instrName);
				}
				labels.push({name: instrName, offset: offset});
				currentGlobalLabel = instrName;
				
			} else {
				// Instruction
				var ranFunc = false;
				instructions.forEach(function(instruction) {
					if(instruction.name == instrName) {
						// The function return how many bytes were written.
						try {
							offset += instruction.func(operands);
						} catch(err) {
							err.message = 'Line ' + i + ' : ' + err.message;
							throw err;
						}
						ranFunc = true;
					}
				});
				
				if(!ranFunc) {
					throw new RangeError('Line ' + i + ' : Unknown instruction : ' + instrName + ' (line ' + i + ')');
				}
				
				// For debugging purposes.
				if(typeof byteStream[byteStream.length - 1] == 'object') {
					byteStream[byteStream.length - 1].line = i;
				}
			}
		}
		
		if(offset >= 65536) {
			throw new RangeError('Line ' + i + ' : You went beyond $FFFF in memory !');
		}
	}
	
	/** END ASSEMBLER **/
	
	/** BEGIN COMPILER **/
	
	n = byteStream.length;
	offset = baseOffset;
	var itemList = [];
	var warnings = {duplicate: false, quantity: false, invalid: false};
	
	for(i = 0; i < n; i++) {
		var b = byteStream[i];
		
		switch(typeof b) {
			case 'number':
				// Leave untouched.
			break;
			
			case 'object':
				// Replace the label with its data, according to the accompanying size attribute.
				var addr = -1;
				labels.forEach(function(label) {
					if(label.name == b.name) {
						addr = label.offset;
					}
				});
				if(addr == -1) {
					if(b.label) {
						console.table(labels);
						throw new SyntaxError('Line ' + b.line + ' : Label ' + b.name + ' is unknown !');
					} else {
						throw new SyntaxError('Line ' + b.line + ' : Invalid operand ' + b.name + ' !');
					}
				}
				
				// 8-bit will calculate (jr) offset, 16-bit will calculate the address.
				if(b.size == 2) {
					// 16-bit
					b = addr % 256;
					byteStream[i+1] = Math.floor(addr / 256);
				} else {
					// 8-bit
					b = addr - (offset + 1);
					if(b < -128 || b > 127) {
						throw new RangeError('Line ' + b.line + ' : jr displacement too important ! Can\'t jr from $' + offset + ' to ' + byteStream[i]);
					}
					
					// Signed to unsigned
					if(b < 0) {
						b += 256;
					}
				}
			break;
			
			default:
				console.table(byteStream);
				throw new TypeError('Encountered invalid byte stream value at index ' + i);
		}
		
		// We now process the thing.
		if(attribs[b].used) {
			warnings.duplicate = true;
		} else {
			attribs[b].used = true;
		}
		if(!attribs[b].qty && i+1 != byteStream.length && byteStream[i+1] != 1) {
			warnings.quantity = true;
		}
		if(!attribs[b].valid) {
			warnings.invalid = true;
		}
		var line = items[b];
		if(!attribs[b].valid) {
			line += ' (hex:' + decToHex(b).toUpperCase() + ')';
		}
		
		line += '</div><div class="col-sm-5">';
		
		i++;
		if(i == byteStream.length) {
			line += 'x[Any qty]';
		} else {
			line += 'x' + byteStream[i] + ' (hex:' + decToHex(byteStream[i]).toUpperCase() + ')';
		}
		
		itemList.push(line);
		
		offset++;
	}
	
	/** END COMPILER **/
	
	var output = itemList.join('</div><div class="col-sm-7">');
	$('#output').html((output == '') ? 'Please type in something on the left.' : '<div class="col-sm-7">' + output + '</div>');
}


$(function() {
	$('#code').attr('contentEditable', 'true');
	
	$('#dismissError').click(function() {
		$('#errorPanel, #lineNumbers').addClass('hidden');
	});
	
	$('#code').focus(function() {
		$('#lineNumbers').addClass('hidden');
	});
	
	$('.form-inline').on('submit', function(evt) {
		try {
			compile(evt);
		} catch(err) {
			$('#errorText').text(err.message);
			$('#errorPanel').removeClass('hidden').attr('aria-hidden', 'false');
			throw err;
		}
	});
});
