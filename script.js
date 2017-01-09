           function fetchUrl(url) {
                return new Promise(function(resolve, reject) {
                    var request = new XMLHttpRequest();
                    request.open('GET', url, true);

                    request.onload = function() {
                        if (request.status >= 200 && request.status < 400) {
                            var data = request.responseText;
                            try {
                                data = JSON.parse(data);
                            } catch (error) {
                                reject(error);
                                return;
                            }
                            
                            if (data.status === 'OK') {
                                resolve(data.result);
                            } else {
                                reject(new Error(data.message));
                            }
                        } else {
                            reject(new Error('server error - ' + request.status))
                        }
                    };

                    request.onerror = function() {
                        reject(new Error('connection error'));
                    };

                    request.send();
                });
            }

function getNetworkName(address) {
    var name = address.split(':');
    return 'tomesh-' + name[name.length - 1];
}

Array.prototype.forEach.call(document.querySelectorAll('.spacer-top'), function(el) {
    var target = el.getAttribute('target');
    if (target) {
        el.onclick = function() {
            location.href = target;
        }
    }
});
