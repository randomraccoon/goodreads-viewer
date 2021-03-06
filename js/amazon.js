// Methods useful for interacting with the Amazon Product Advertising API
// https://docs.aws.amazon.com/AWSECommerceService/latest/DG/rest-signature.html
// Keys must be initialized for this to function.
let AMAZON_PUBLIC_KEY;
let AMAZON_PRIVATE_KEY;
let AMAZON_TAG;

//argsObj should include ISBN, Title, & Author
function requestBookItem(argsObj, cb) {
  makeAmazonRequest('ItemSearch', objToArgString(argsObj), r => cb($(r).find('Item')[0]));
}

function requestItemOffer(item, callback) {
  let asin = getItemAsin(item);
  makeAmazonRequest('ItemLookup', `ItemId=${asin}`, callback);
}

//Finds the price of an book described by the object (ISBN, Title, Author)
function requestItemPrice(item, callback) {
  requestItemOffer(item, (offer)=>{
    callback(getOfferPrice(offer));
  })
}

function requestImages(item, callback) {
  let asin = getItemAsin(item);
  makeAmazonRequest('ItemLookup', `ResponseGroup=Images&ItemId=${asin}`, callback);
}

function makeAmazonRequest(operation, customArgs, callback) {
  let base = 'http://webservices.amazon.com/onca/xml?';
  let args = generateQueryArgs(operation, customArgs);
  let signature = '&Signature=' + getSignature(args, AMAZON_PRIVATE_KEY);
  let url = base + args + signature;
  completeAmazonRequest(url, callback);
}

// If error due to throttling, keeps calling until successful
function completeAmazonRequest(url, callback) {
  $.get(url)
    .done(callback)
    .fail((e) => {
      if (e.status === 503) {
        delay = Math.floor(Math.random() * 1000) + 500; //0.5-1.5sec
        setTimeout(completeAmazonRequest(url, callback), delay);
      } else if (e.status === 403) {
        console.log("Malformed request! " + url);
        console.log(e);
      } else {
        console.log(e);
        console.log($(e.responseText).find('error').text());
      };
    });
}

const getItemAsin = (item) => $($(item).find('ASIN')[0]).text();

const getItemUrl = (item) => $($(item).find('ItemLink')[0]).find('URL').text();

const getOfferPrice = (offer) => $(offer).find('LowestNewPrice>FormattedPrice').text();

//Takes book information (ISBN, Title, Author) and creates part of a query
function objToArgString(argsObj) {
  let args = [];
  if (argsObj.author && argsObj.author.length) {
    let author = argsObj.author.replace(/  /g, ' ');
    let authorI = author.indexOf(',');
    if (authorI >= 0) author = author.splice(0, authorI);
    args.push(author.length ? `Author=${author}` : '');
  }
  if (argsObj.title && argsObj.title.length) {
    args.push(`Title=${argsObj.title}`);
  }
  if (argsObj.isbn && argsObj.isbn.length) {
    args.push(`Isbn=${argsObj.isbn}`);
  }
  args = args.join('&');

  return (args);
}

//Encodes more characters than the standard encodeURIComponent
function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()]/g,
    c => ('%' + c.charCodeAt(0).toString(16))
  ).replace(/\*/g,''); //If there's an asterisk, it will fail, encoded or not
}

//Pretties up the query string for the signature hash
function generateQueryArgs(operation, customArgs) {
  let standardArgs = `Service=AWSECommerceService&AWSAccessKeyId=${AMAZON_PUBLIC_KEY}&Version=2013-08-01&AssociateTag=${AMAZON_TAG}`;
  //They don't allow price search on kindle books! SearchIndex=KindleStore :(
  if (operation === 'ItemSearch') standardArgs += '&SearchIndex=Books';
  else if (operation === 'ItemLookup') {
    if (customArgs.indexOf('ResponseGroup') < 0) standardArgs += '&ResponseGroup=Offers';
  }
  let args = standardArgs + '&Operation=' + operation + '&' + customArgs;
  let timestamp = new Date().toISOString().replace(/(\.)(\d)+/, "");
  args += '&Timestamp=' + timestamp;
  args = args.split('&');
  args = args.map(a => a.split('=')).map(o => o[0] + '=' + fixedEncodeURIComponent(o[1]));
  args = args.sort().join('&');
  return args;
}

// npm js-sha256 package
function getSignature(argStr, key) {
  let prepend =
    `GET
webservices.amazon.com
/onca/xml
`;
  let stringToSign = prepend + argStr;

  var hash = sha256.hmac.create(key);
  hash.update(stringToSign);
  hash = hash.hex();
  hash = hexToBase64(hash);

  return encodeURIComponent(hash);
}

//converts base 16 string to base 64
function hexToBase64(hexStr) {
  return btoa(hexStr.match(/\w{2}/g)
    .map(a=>String.fromCharCode(parseInt(a,16)))
    .join(""));
}
