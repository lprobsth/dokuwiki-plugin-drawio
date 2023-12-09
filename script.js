// Embeded editor
////var editor = 'https://www.draw.io/?embed=1&ui=atlas&spin=1&proto=json';
var editor= JSINFO['plugin_drawio']['url'] + '?embed=1&ui=atlas&spin=1&proto=json';
var toolbarPossibleExtension=JSINFO['plugin_drawio']['toolbar_possible_extension'];
var initial = null;
var name = null;
var imagePointer = null;

function edit_button(editButton)
{
    var imageId = editButton.getAttribute('data-image-id');
    var image = document.getElementById(imageId);
    edit(image);
}

function edit(image)
{   
    // check auth
    var imgPointer = image;
    jQuery.post(
        DOKU_BASE + 'lib/exe/ajax.php',
        {
            call: 'plugin_drawio', 
            imageName: imgPointer.getAttribute('id'),
            action: 'get_auth'
        },
		function(data) {
			if (data != 'true') return;
			edit_cb(imgPointer);
		}
	);
}

function edit_cb(image)
{
    var zIndex = 999;
    if(JSINFO && JSINFO['plugin_drawio']){
        zIndex = JSINFO['plugin_drawio']['zIndex'];
    }

    imagePointer = image;
    imageFormat = imagePointer.getAttribute('id').split('.');
    if (imageFormat.length>2) {
        alert('File name format or extension error: should be filename.extension (available extension :' + toolbarPossibleExtension + ')');
        return;
    } else if (imageFormat.length == 1) {
        console.info('use default exention png');
        imageFormat = "png";
    } else {
        imageFormat=imageFormat.pop();
    }

    var iframe = document.createElement('iframe');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('class', 'drawio');
    iframe.setAttribute('style', 'z-index: ' + zIndex + ';');

    var close = function()
    {
        window.removeEventListener('message', receive);
        document.body.removeChild(iframe);
    };
    
    var draft = localStorage.getItem('.draft-' + name);

    // Prefer the draft from browser cache
    if(draft == null){
        // Try to find on-disk stored draft file
        jQuery.post(
            DOKU_BASE + 'lib/exe/ajax.php',
            {
                call: 'plugin_drawio', 
                imageName: imagePointer.getAttribute('id'),
                action: 'draft_get'
            },
            function(data) {
                if (data.content != 'NaN') {

                    // Set draft from received data
                    draft = data;

                    // Handle the discard - remove on disk
                    if (!confirm("A version of this diagram from " + new Date(data.lastModified) + " is available. Would you like to continue editing?"))
                    {   
                        // clean draft variable
                        draft = null;

                         // Remove all draft files
                        jQuery.post(
                            DOKU_BASE + 'lib/exe/ajax.php',
                            {
                                call: 'plugin_drawio', 
                                imageName: imagePointer.getAttribute('id'),
                                action: 'draft_rm'
                            }
                        );
                    }
                }
            }
        );
    } 
    else 
    {

        draft = JSON.parse(draft);
                    
        if (!confirm("A version of this diagram from " + new Date(draft.lastModified) + " is available. Would you like to continue editing?"))
        {
            draft = null;
        }
    }
    
    var receive = function(evt)
    {
        if (evt.data.length > 0)
        {
            var msg = JSON.parse(evt.data);
			// wait for init msg
            if (msg.event == 'init')
            {
                if (draft != null) // send draft 
                {
                    iframe.contentWindow.postMessage(JSON.stringify({action: 'load',
                        autosave: 1, xml: draft.xml}), '*');
                    iframe.contentWindow.postMessage(JSON.stringify({action: 'status',
                        modified: true}), '*');
                }
                else // get local image
                {                    
                    if (imageFormat == 'png')
                    {
                        jQuery.post(
                            DOKU_BASE + 'lib/exe/ajax.php',
                            {
                                call: 'plugin_drawio', 
                                imageName: imagePointer.getAttribute('id'),
                                action: 'get_png'
                            },
                            function(data){
                                iframe.contentWindow.postMessage(JSON.stringify({action: 'load',
                                    autosave: 1, xmlpng: data.content}), '*');
                            }
                        );
                    }
                    else if (imageFormat == 'svg')
                    {
                        jQuery.post(
                            DOKU_BASE + 'lib/exe/ajax.php',
                            {
                                call: 'plugin_drawio', 
                                imageName: imagePointer.getAttribute('id'),
                                action: 'get_svg'
                            },
                            function(data){
                                //var svg = new XMLSerializer().serializeToString(data.content.firstChild);
                                iframe.contentWindow.postMessage(JSON.stringify({action: 'load',
                                    autosave: 1, xml: data.content}), '*');
                            }
                        );
                    }
					else {
                        console.log('error extension not compatible');
                    }
                }
            }
            else if (msg.event == 'export')
            {
                imgData=null;
                if(msg.format == 'xmlpng')
                {
                    imgData = msg.data ;
                    image.setAttribute('src', imgData);
                    imgSrc=image.getAttribute('src');
                    imgSrc=imgSrc.replace('plugins/drawio/blank-image.png','exe/fetch.php?media=');
                }
                else if (msg.format == 'svg') 
                {
                    // Extracts SVG DOM from data URI to enable links
                    var imgBase64 = msg.data.substring(msg.data.indexOf(',') + 1);
                    // fix utf-8 encoding problem
                    // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
                    imgData = decodeURIComponent(atob(imgBase64).split('').map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    var baseElement = document.getElementById(image.id);
                    var isSvgEmbed = 0;
                    if(baseElement.parentNode.classList.contains('drawio_svgembed')) {
                        var objectElement = baseElement.parentNode.querySelector('object');
                        // var svgDocument = objectElement.contentDocument;
                        // var svgElement = svgDocument.querySelector('svg');
                        // objectElement.innerHTML = imgData;
                        // svgElement.
                        var currentSrc = objectElement.getAttribute('data');
                        var newSrc = currentSrc + (currentSrc.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

                        objectElement.setAttribute('data', newSrc);

                    } else {
                        var oldSvgElement = baseElement;
                        var oldSvgElementOnclick = oldSvgElement.getAttribute("onclick");
                        var odlSvgParentNode = oldSvgElement.parentNode;
                        odlSvgParentNode.innerHTML = imgData;
                        var newSvgElement = odlSvgParentNode.firstElementChild;
                        var wigth = newSvgElement.getAttribute("width");
                        var height = newSvgElement.getAttribute("height");
                        newSvgElement.style.width = wigth;
                        newSvgElement.style.height = height;
                        newSvgElement.setAttribute("class","mediacenter");
                        if (oldSvgElementOnclick != null) { // previous svg has onclick property - keep it here
                            newSvgElement.style.cursor = "pointer";
                            newSvgElement.setAttribute('onclick', 'edit(this);');
                        }
                        newSvgElement.id=image.id;
                    }
                }
                
                localStorage.setItem(name, JSON.stringify({lastModified: new Date(), data: imgData}));
                localStorage.removeItem('.draft-' + name);
                draft = null;
				close();

                // Save into dokuwiki
                jQuery.post(
                    DOKU_BASE + 'lib/exe/ajax.php',
                    {
                        call: 'plugin_drawio', 
                        imageName: imagePointer.getAttribute('id'),
                        content: msg.data,
                        action: 'save'
                    }
                );

                // Remove all draft files
                jQuery.post(
                    DOKU_BASE + 'lib/exe/ajax.php',
                    {
                        call: 'plugin_drawio', 
                        imageName: imagePointer.getAttribute('id'),
                        action: 'draft_rm'
                    }
                );
                
                // Clean cache of this page
                var url = new URL(window.location.href);
                url.searchParams.set('purge', 'true');
                jQuery.get(url);
                
            }
            else if (msg.event == 'autosave')
            {
                dr = JSON.stringify({lastModified: new Date(), xml: msg.xml});
                localStorage.setItem('.draft-' + name, dr);

                // Save on-disk
                jQuery.post(
                    DOKU_BASE + 'lib/exe/ajax.php',
                    {
                        call: 'plugin_drawio', 
                        imageName: imagePointer.getAttribute('id'),
                        content: dr,
                        action: 'draft_save'
                    }
                );
            }
            else if (msg.event == 'save')
            {
                
                if (imageFormat === 'png')
                {
                    iframe.contentWindow.postMessage(JSON.stringify({action: 'export',
                    format: 'xmlpng', xml: msg.xml, spin: 'Updating page'}), '*');
                    dr = JSON.stringify({lastModified: new Date(), xml: msg.xml});
                    localStorage.setItem('.draft-' + name, dr);
                } 
                else if (imageFormat ==='svg') 
                {
                    iframe.contentWindow.postMessage(JSON.stringify({action: 'export',
                    format: 'xmlsvg', xml: msg.xml, spin: 'Updating page'}), '*');
                    dr = JSON.stringify({lastModified: new Date(), xml: msg.xml});
                    localStorage.setItem('.draft-' + name, dr);
                }
                // Save on-disk
                jQuery.post(
                    DOKU_BASE + 'lib/exe/ajax.php',
                    {
                        call: 'plugin_drawio', 
                        imageName: imagePointer.getAttribute('id'),
                        content: dr,
                        action: 'draft_save'
                    }
                );
            }
            else if (msg.event == 'exit')
            {
                localStorage.removeItem('.draft-' + name);
                draft = null;

                // Remove all draft files
                jQuery.post(
                    DOKU_BASE + 'lib/exe/ajax.php',
                    {
                        call: 'plugin_drawio', 
                        imageName: imagePointer.getAttribute('id'),
                        action: 'draft_rm'
                    }
                );

                // Final close (dont know why though)
                close();
            }
        }
    };
    window.addEventListener('message', receive);
    iframe.setAttribute('src', editor);
    document.body.appendChild(iframe);
};


// Toolbar menu items
function getImageName(){
    seq = JSINFO.id.split(":");
    seq = seq.slice(0,seq.length-1);
    seq.push("diagram1");
    return seq.join(":");
};

 function generateToolBar(){
     var listExt= [];
     for (extension in toolbarPossibleExtension) {
         listExt[extension] = {
             type   : "format",
             title  : "",
             icon   : "../../plugins/drawio/icon_" + toolbarPossibleExtension[extension] + ".png" ,
             open   : "{{drawio>" + getImageName() + "." + toolbarPossibleExtension[extension] + "}}",
             close  : ""
            }
     }
     return listExt;
 };


if (typeof window.toolbar !== 'undefined') {
    // toobar definition in case of multi extension defined in conf
    if (toolbarPossibleExtension.length >1 ) {
        toolbar[toolbar.length] = {
            type: "picker",
            title: "",
            icon: "../../plugins/drawio/icon.png",
            key: "",
            class  : "pk_hl",
            block  : true,
            list: generateToolBar(),
            close: ""
    };
    
    } else if (toolbarPossibleExtension.length = 1) {
        // toobar definition in case of only one extension defined
        if (toolbarPossibleExtension[0] == ""){
            toolbar[toolbar.length] = {
                type: "format",
                title: "",
                icon: "../../plugins/drawio/icon.png",
                key: "",
                open: "{{drawio>" + getImageName() + "}}",
                close: ""
            };
        } else {
            // toobar definition in case of none extension defined
            toolbar[toolbar.length] = {
                type: "format",
                title: "",
                icon: "../../plugins/drawio/icon.png",
                key: "",
                open: "{{drawio>" + getImageName() + "." + toolbarPossibleExtension[0] + "}}",
                close: ""
            };
        }
        
    }
};
