// initialize

// artificially limit the message size
var maxMessageSize = 1000;

var nonce; 
// put image in the canvas and display it
var importImage = function (e) {
    var reader = new FileReader();

    reader.onload = function (event) {
        // set the preview
        document.getElementById('preview').style.display = 'block';
        document.getElementById('preview').src = event.target.result;

        // wipe all the fields clean
        document.getElementById('message').value = '';
        document.getElementById('password').value = '';
        document.getElementById('password2').value = '';
        document.getElementById('messageDecoded').innerHTML = '';

        // read the data into the canvas element
        var img = new Image();
        img.onload = function () {
            var ctx = document.getElementById('canvas').getContext('2d');
            ctx.canvas.width = img.width;
            ctx.canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            decode();
        };
        img.src = event.target.result;
    };

    reader.readAsDataURL(e.target.files[0]);
};

window.addEventListener('DOMContentLoaded', (event) => {
    // add action to the file input
    var input = document.getElementById('file');
    input.addEventListener('change', importImage);

    // add action to the encode button
    var encodeButton = document.getElementById('encode');
    encodeButton.addEventListener('click', encode);

    // add action to the decode button
    var decodeButton = document.getElementById('decode');
    decodeButton.addEventListener('click', decode);
});

// encode the image and save it
var encode = function () {
    var message = document.getElementById('message').value;
    var password = document.getElementById('password').value;
    var output = document.getElementById('output');
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');

    // encrypt the message with ChaCha20 using supplied password if necessary
    if (password.length > 0) {
        // Convert the message to bytes
        var messageBytes = new TextEncoder().encode(message);

        // Generate a key from the password using sha256 hash
        var key = new Uint8Array(nacl.hash(new TextEncoder().encode(password)).slice(0, 32));

        // Ensure both messageBytes and key are Uint8Array
        if (!(messageBytes instanceof Uint8Array) || !(key instanceof Uint8Array)) {
            console.error("messageBytes or key is not a Uint8Array");
            return;
        }

        // Generate a random 24-byte nonce
        nonce = nacl.randomBytes(24);

        console.log("messageBytes:", messageBytes);
        console.log("key:", key);
        console.log("nonce:", nonce);

        try {
            // Use ChaCha20 to encrypt the message
            var encryptedMessage = nacl.secretbox(messageBytes, nonce, key);
            console.log("encryptedMessage:", encryptedMessage);
        } catch (error) {
            console.error("Error in nacl.secretbox:", error);
            return;
        }

        // Convert the encrypted message to base64 for embedding
        message = btoa(String.fromCharCode.apply(null, encryptedMessage));
    } else {
        message = JSON.stringify({ 'text': message });
    }

    // exit early if the message is too big for the image
    var pixelCount = ctx.canvas.width * ctx.canvas.height;
    if ((message.length + 1) * 16 > pixelCount * 4 * 0.75) {
        alert('Message is too big for the image.');
        return;
    }

    // exit early if the message is above an artificial limit
    if (message.length > maxMessageSize) {
        alert('Message is too big.');
        return;
    }

    // encode the encrypted message with the supplied password
    // ...

// Include nonce in the encoded message
var encodedNonce = btoa(String.fromCharCode.apply(null, nonce));

// Concatenate nonce and message
var encodedMessageWithNonce = encodedNonce + message;

// encode the encrypted message with the supplied password
var imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
encodeMessage(imgData.data, sjcl.hash.sha256.hash(password), encodedMessageWithNonce); // <-- Keep this line if sjcl is required
ctx.putImageData(imgData, 0, 0);

// ...

    console.log("SJCL Encoding - Before:", sjcl.encrypt(password, message));
    encodeMessage(imgData.data, sjcl.hash.sha256.hash(password), message); // <-- Keep this line if sjcl is required
    ctx.putImageData(imgData, 0, 0);
    console.log("SJCL Encoding - After:", sjcl.encrypt(password, message));

    // view the new image
    alert('Done! When the image appears, save and share it with someone.');

    output.src = canvas.toDataURL();
};

// decode the image and display the contents if there is anything
var decode = function () {
    var password = document.getElementById('password2').value;
    var passwordFail = 'Password is incorrect or there is nothing here.';

    // decode the message with the supplied password
    var ctx = document.getElementById('canvas').getContext('2d');
    var imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    var message = decodeMessage(imgData.data, sjcl.hash.sha256.hash(password));

    // try to parse the JSON
    var obj = null;
    try {
        obj = JSON.parse(message);
    } catch (e) {
        // display the "choose" view
        document.getElementById('choose').style.display = 'block';
        document.getElementById('reveal').style.display = 'none';

        if (password.length > 0) {
            alert(passwordFail);
        }
    }

    if (password.length > 0) {
        try {
            // Convert the base64-encoded message back to bytes
            var encryptedMessage = atob(message);

            // Generate the key from the password
            var key = new Uint8Array(nacl.hash(new TextEncoder().encode(password)));

            // ...

// Extract nonce and message from the encoded message
var encodedNonce = message.substring(0, 32); // Assuming the nonce is 24 bytes, adjust as needed
var encodedMessage = message.substring(32);

// Convert encodedNonce back to Uint8Array
var nonce = new Uint8Array(atob(encodedNonce).split('').map(function (c) { return c.charCodeAt(0); }));

// Decrypt the message using the extracted nonce
var decryptedMessageBytes = nacl.secretbox.open(new Uint8Array(atob(encodedMessage)), nonce, key);

// ...


            // Decrypt the message
           // var decryptedMessageBytes = nacl.secretbox.open(new Uint8Array(encryptedMessage), nonce, key);

            // Convert the decrypted message bytes to string
            message = new TextDecoder().decode(decryptedMessageBytes);
        } catch (e) {
            alert(passwordFail);
        }
    }
    // display the "reveal" view
    if (obj) {
        document.getElementById('choose').style.display = 'none';
        document.getElementById('reveal').style.display = 'block';

        // decrypt if necessary
        if (obj.ct) {
            try {
                obj.text = sjcl.decrypt(password, message);
            } catch (e) {
                alert(passwordFail);
            }
        }

        // escape special characters
        var escChars = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            '\'': '&#39;',
            '/': '&#x2F;',
            '\n': '<br/>'
        };
        var escHtml = function (string) {
            return String(string).replace(/[&<>"'\/\n]/g, function (c) {
                return escChars[c];
            });
        };
        document.getElementById('messageDecoded').innerHTML = escHtml(obj.text);
    }
};

// returns a 1 or 0 for the bit in 'location'
var getBit = function (number, location) {
    return ((number >> location) & 1);
};

// sets the bit in 'location' to 'bit' (either a 1 or 0)
var setBit = function (number, location, bit) {
    return (number & ~(1 << location)) | (bit << location);
};

// returns an array of 1s and 0s for a 2-byte number
var getBitsFromNumber = function (number) {
    var bits = [];
    for (var i = 0; i < 16; i++) {
        bits.push(getBit(number, i));
    }
    return bits;
};

// returns the next 2-byte number
var getNumberFromBits = function (bytes, history, hash) {
    var number = 0,
        pos = 0;
    while (pos < 16) {
        var loc = getNextLocation(history, hash, bytes.length);
        var bit = getBit(bytes[loc], 0);
        number = setBit(number, pos, bit);
        pos++;
    }
    return number;
};

// returns an array of 1s and 0s for the string 'message'
var getMessageBits = function (message) {
    var messageBits = [];
    for (var i = 0; i < message.length; i++) {
        var code = message.charCodeAt(i);
        messageBits = messageBits.concat(getBitsFromNumber(code));
    }
    return messageBits;
};

// gets the next location to store a bit
var getNextLocation = function (history, hash, total) {
    var pos = history.length;
    var loc = Math.abs(hash[pos % hash.length] * (pos + 1)) % total;
    while (true) {
        if (loc >= total) {
            loc = 0;
        } else if (history.indexOf(loc) >= 0) {
            loc++;
        } else if ((loc + 1) % 4 === 0) {
            loc++;
        } else {
            history.push(loc);
            return loc;
        }
    }
};

// encodes the supplied 'message' into the CanvasPixelArray 'colors'
var encodeMessage = function (colors, hash, message) {
    // make an array of bits from the message
    var messageBits = getBitsFromNumber(message.length);
    messageBits = messageBits.concat(getMessageBits(message));

    // this will store the color values we've already modified
    var history = [];

    // encode the bits into the pixels
    var pos = 0;
    while (pos < messageBits.length) {
        // set the next color value to the next bit
        var loc = getNextLocation(history, hash, colors.length);
        colors[loc] = setBit(colors[loc], 0, messageBits[pos]);

        // set the alpha value in this pixel to 255
        // we have to do this because browsers do premultiplied alpha
        // see for example: http://stackoverflow.com/q/4309364
        while ((loc + 1) % 4 !== 0) {
            loc++;
        }
        colors[loc] = 255;

        pos++;
    }
};

// returns the message encoded in the CanvasPixelArray 'colors'
var decodeMessage = function (colors, hash) {
    // this will store the color values we've already read from
    var history = [];

    // get the message size
    var messageSize = getNumberFromBits(colors, history, hash);

    // exit early if the message is too big for the image
    if ((messageSize + 1) * 16 > colors.length * 0.75) {
        return '';
    }

    // exit early if the message is above an artificial limit
    if (messageSize === 0 || messageSize > maxMessageSize) {
        return '';
    }

    // put each character into an array
    var message = [];
    for (var i = 0; i < messageSize; i++) {
        var code = getNumberFromBits(colors, history, hash);
        message.push(String.fromCharCode(code));
    }

    // the characters should parse into valid JSON
    return message.join('');
};
