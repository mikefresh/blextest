if(!L.Icon.Default.imagePath) {
  L.Icon.Default.imagePath = "/paraffin/lib/leaflet/images";
}

var Paraffin = {
  CLOUDMADE: 'cloudmade', // opts: { style: 998, key: 'abcdef0123456' }
  MAPQUEST:  'mapquest',
  GOOGLE:    'google',
  TONER:     'toner',
  BING:      'bing',
  GEOJSON:   'geojson',   // opts: { url: 'http://what/geo.json', handler: function(e) {...}, options }  -or-
                          //       { object: SOME_VALID_GEOJSON, handler: function(e) {...}, options }
                          //       where handler is a leaflet featureparse function
  TILEJSON:  'tilejson',  // opts: { url: 'http://whatever/layer.json', template: '{{id}}',  }
  
  /* opts:
      divId: 'map',                                         // required
      extent: [ { lat: s, lon: w }, { lat: n, lon: e } ],   // optional
      center: { lat: y, lon: x } // optional
      zoom: N // optional
      minZoom: N, maxZoom: N
  */

  Map: function(opts) {
    var map = new L.Map(opts.divId, {minZoom: opts.minZoom, maxZoom: opts.maxZoom, attributionControl: true });
    this.map = map;
    this.opts = opts;
    this.spinner = null;
    this.remainingLayers = 0;
    this.hash = opts.hash;
    this.ready = false;
    
    this.geojsonOptions = {
      pointToLayer: function(latlng) {
        return new L.CircleMarker(latlng, {
          radius: 8,
          fillColor: "#00a0dd",
          color: "#000",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });
      }
    };
    
    this.emptyGeoJSON = { type: 'FeatureCollection', features: [] };

    if(opts.extent) {
      this.setExtent(opts.extent);
    } else if(opts.center) {
      this.setCenter(opts.center, opts.zoom || 16);
    }
    
    if(opts.geolocate && opts.geolocate != 'manual') {
      this.enableGPS({
        watch: true,
        noLocation: function() { $.ajax({ async: true, type: 'GET', url: '/disable_gps', data: {}, cache: false, success: function(data) { } }); }
      });
    }
  }
};

Paraffin.Map.prototype.setExtent = function(extent) {
  var bounds = [ [extent[0].lat, extent[0].lon], [extent[1].lat, extent[1].lon] ];
  this.map.fitBounds(bounds);
};

Paraffin.Map.prototype.getExtent = function(extent) {
  var b = this.map.getBounds();
  return [
    { lat: b._southWest.lat, lon: b._southWest.lng },
    { lat: b._northEast.lat, lon: b._northEast.lng }
  ];
};

Paraffin.Map.prototype.setCenter = function(center, zoom) {
  this.map.setView([center.lat, center.lon], zoom);
};


Paraffin.Map.prototype.initializeLayers = function(baseLayers, layers) {
  var that = this;
  var popup = null;
  var baseMaps = {};
  var overlays = {};
  this.overlays = overlays;
  
  for(var i in baseLayers) {
    var bl = baseLayers[i];
    var newLayer = null;
    if(bl == 'street') {
      newLayer = baseMaps.Street = this.createLayer(Paraffin.CLOUDMADE);
    } else if(bl == 'toner') {
      newLayer = baseMaps.Toner = this.createLayer(Paraffin.TONER);
    } else if(bl == 'satellite') {
      newLayer = baseMaps.Satellite = this.createLayer(Paraffin.MAPQUEST);
    } else if(bl == 'google') {
      newLayer = baseMaps.Satellite = this.createLayer(Paraffin.GOOGLE);
    } else if(bl == 'bing') {
      newLayer = baseMaps.Satellite = this.createLayer(Paraffin.BING);
    }
    newLayer.id = bl;
    newLayer.base = true;
    if(i == baseLayers.length - 1) {
      this.map.addLayer(newLayer);
    }
  }

  // Spinner / loading indicator
  var wasRemaining = this.remainingLayers;
  this.remainingLayers += layers.length;
  if(wasRemaining == 0 && this.remainingLayers > 0) {
    var target = $('#wrapper').get(0);
    if(!this.spinner) {
      this.spinner = new Spinner({zIndex: 4000});
    }
    this.spinner.spin(target);
  }
  var onCreatedLayer = function(l) {
    that.remainingLayers -= 1;
    if(that.remainingLayers == 0 && that.spinner) {
      var target = $(that.map._container).get(0);
      that.spinner.stop();
      if(that.onReady) {
        that.onReady();
      }
      that.ready = true;
    }
  };
  var onLayerError = function(text) {
    onCreatedLayer(); // Make sure the spinner goes away
  };

    
  var initLayerFromBedrock = function(layer) {
    var group = this.map;
    if(layer.ty == 'geojson') {
      opts = {};
    
      if(layer.geometry_type == 'point') {
        if(layer.style) {
          opts.pointToLayer = function(feature, ll) { return new L.CircleMarker(ll, layer.style); };
        }
        /*  if(layer.style.icon) {
              var icon_opts = layer.style.icon;
              for(var o in icon_opts) {
                var val = icon_opts[o];
                if(isArray(val)) {
                  icon_opts[o] = new L.Point(val[0], val[1]);
                }
              }
              var MyIcon = L.Icon.extend(icon_opts);
              var TheIcon = new MyIcon();
              var opts = { pointToLayer: function(ll) { return new L.Marker(ll, { icon: TheIcon }); } };
            } else {
              var opts = { pointToLayer: function(ll) { return new L.CircleMarker(ll, layer.style); } };
            }

        */
      }
      
        
      opts.onEachFeature = function (feature, featureLayer) {
        if(layer.template) {
          var html = Mustache.to_html(layer.template, feature.properties);
          featureLayer.bindPopup(html, { minWidth: 220 });
          
          if(feature.properties.classes) {
            if(typeof(featureLayer.options) != 'undefined') {
              // Single feature
              featureLayer.options.classes = feature.properties.classes;
            } else if(featureLayer._layers) {
              // Multipolygon
              for(var k in featureLayer._layers) {
                var l = featureLayer._layers[k];
                l.options.classes = feature.properties.classes;
              }
            }
          } 
          
          if(layer.mouseover) {
            (function(feature, featureLayer) {
              featureLayer.on('mouseover', function() {
                if(popup) {
                  that.map.closePopup();
                } else {
                  popup = new L.Popup();
                }
                if(featureLayer._latlng) {
                  popup.setLatLng(new L.LatLng(featureLayer._latlng.lat, featureLayer._latlng.lng));
                } else {
                  var bounds = featureLayer.getBounds();
                  var lat = (bounds._southWest.lat + bounds._northEast.lat)/2;
                  var lng = (bounds._southWest.lng + bounds._northEast.lng)/2;
                  popup.setLatLng(new L.LatLng(lat, lng));
                }
                popup.setContent(html);
                that.map.openPopup(popup);
              });
            })(feature, featureLayer);
          }
        }
      };
      
      var styleHandler = layer.style_handler ? eval('('+layer.style_handler+')') : null;
      if(styleHandler) {
        opts.style = function(feature) {
          //var base = feature.properties.classes || {};
          overrides = styleHandler(feature);
          return $.extend({}, layer.style || {}, overrides);
        };
      } else {
        opts.style = layer.style;
      }

      if(layer.elements) {
        overlays[layer.name] = that.addLayer(Paraffin.GEOJSON, { object: layer.elements, options: opts, onCreate: onCreatedLayer, hide: layer.hide });
      } else if(layer.url) {
        overlays[layer.name] = that.addLayer(Paraffin.GEOJSON, { url: layer.url, options: opts, onCreate: onCreatedLayer, hide: layer.hide });
      }
      
      $(overlays[layer.name]._container).addClass(layer.id);
    
      
    } else if(layer.ty == 'tilejson') {
      var l = (function(layer) {
        return that.createLayer(Paraffin.TILEJSON, {
          url: layer.url,
          onCreate: onCreatedLayer,
          onError: onLayerError,
          interaction: layer.interaction,
          template: layer.template,
          zIndex: layer.zindex
        });
      })(layer);
      overlays[layer.name] = l;
      if(!layer.hide) {
        that.map.addLayer(l);
      }
    }
    overlays[layer.name].id = layer.id;
  };


  for(var i in layers) {
    var layerDef = layers[i];
    var l = initLayerFromBedrock(layerDef);
  }
  
  if(this.opts.layerControl) {
    var layersControl = new L.Control.Layers(baseMaps, overlays);
    this.map.addControl(layersControl);
  }
};

Paraffin.Map.prototype.addLayer = function(type, opts) {
  var newLayer = this.createLayer(type, opts);
  if(!opts.hide) {
    this.map.addLayer(newLayer);
  }
  return newLayer;
};

Paraffin.Map.prototype.createLayer = function(type, opts) {

  // Types: see constants at the top of Paraffin
  
  if(type == Paraffin.CLOUDMADE) {
    if(!this.opts.cloudmadeKey || !this.opts.cloudmadeStyle) {
      throw "For a CloudMade layer the map opts needs 'cloudmadeKey' and 'cloudmadeStyle' values for the API key and style ID.";
    }
    var cloudmadeUrl = 'http://{s}.tile.cloudmade.com/' + this.opts.cloudmadeKey + '/' + this.opts.cloudmadeStyle + '/256/{z}/{x}/{y}.png';
    var layer = new L.TileLayer(cloudmadeUrl, { maxZoom: 18 });
    //this.map.addLayer(layer);
    return layer;

  } else if(type == Paraffin.MAPQUEST) {
    //var mapquestUrl = 'http://{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.png';
    var mapquestUrl = 'http://{s}.mqcdn.com/naip/{z}/{x}/{y}.png';
    var subDomains = ['oatile1','oatile2','oatile3','oatile4'];
    var mapquestAttrib = 'Data, imagery and map information provided by <a href="http://open.mapquest.co.uk" target="_blank">MapQuest</a>, ' +
      '<a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> and contributors.';
    var layer = new L.TileLayer(mapquestUrl, {maxZoom: 18, attribution: mapquestAttrib, subdomains: subDomains});
    //this.map.addLayer(layer);
    return layer;
    
  } else if(type == Paraffin.GOOGLE) {
    var layer = new L.Google('SATELLITE');
    //this.map.addLayer(layer);
    return layer;
  
  } else if(type == Paraffin.BING) {
    var layer = new L.BingLayer("AtX0UxXkWS3Ww0h73R-sHuB1_qQWvq28PrA9vsxG9HQyNBOTO3_cqfoBPZwfvJvf", { type: 'AerialWithLabels' });
    //this.map.addLayer(layer);
    return layer;
    
  } else if(type == Paraffin.TONER) {
    var tonerBase = new L.StamenTileLayer("toner");
    //this.map.addLayer(tonerBase);
    return tonerBase;
    
    
  } else if(type == Paraffin.GEOJSON) {
    var map = this.map, that = this;
    
    if(opts.url) {
      var geojsonLayer = new L.GeoJSON(this.emptyGeoJSON, opts.options || this.geojsonOptions);
      $.ajax({
        async: true,
        type: 'GET',
        dataType: 'json',
        url: opts.url,
        cache: true,
        success: function(data) {
          geojsonLayer.addData(data);
          if(opts.onCreate) {
            opts.onCreate(geojsonLayer);
          }
        }
      });
      return geojsonLayer;
            
    } else if(opts.object) {
      var geojsonLayer = new L.GeoJSON(opts.object, opts.options || this.geojsonOptions);
      if(opts.onCreate) {
        opts.onCreate(geojsonLayer);
      }
      return geojsonLayer;
    }
    
    
  } else if(type == Paraffin.TILEJSON) {
    var layer = this.createTileJSON(opts)
    return layer;
    
  } else {
    throw "Unknown layer type: " + type;
  }
};

Paraffin.Map.prototype.removeLayer = function(layer) {
  this.map.removeLayer(layer);
};


/* opts: { watch: true|false } */
Paraffin.Map.prototype.enableGPS = function(opts) {
  var newOpts = opts;
  opts.map = this.map;
  this.gps = new Paraffin.GPS(newOpts);
};



Paraffin.Map.prototype.createTileJSON = function(opts) {
  var that = this;
  var group = new L.LayerGroup();
  
  $.ajax({ dataType: 'json', url: opts.url, data: {}, crossDomain: true, success: function(tilejson, textStatus, jqXHR) {
    tilejson.tilejson = '2.0.0'; // tilemill isn't returning it right so we have to hack it
    
    var layer = L.TileJSON.createTileLayer(tilejson, {});
    layer.id = tilejson.id;
    
    if(opts.zIndex) {
      layer.setZIndex(opts.zIndex);
    }
    group.addLayer(layer);
    
    if(!that.opts.extent && !that.opts.center) {
      var southWest = [tilejson.bounds[1], tilejson.bounds[0]],
          northEast = [tilejson.bounds[3], tilejson.bounds[2]];
       var bounds   = [southWest, northEast];
       that.map.fitBounds(bounds);
       that.bounds = bounds;
      }
       
    if(opts.onCreate) {
      opts.onCreate(layer);
    }
    if(opts.interaction && tilejson.grids) {
      var url = tilejson.grids[0];
      var utfGrid = new L.UtfGrid(url, { resolution: 4, useJsonP: false });
      utfGrid.grid = true;
      
      utfGrid.on('click', function (e) {
        //click events are fired with e.data==null if an area with no hit is clicked
        if (e.data) {
          var ll = e.latlng;
          if(opts.template) {
            var html = Mustache.to_html(opts.template, e.data);
          } else {
            //var html = o.formatter({ format: 'full' }, e.data);
          }
          if(!that.popup) {
            that.popup = new L.Popup();
          }
          that.popup.setLatLng(ll);
          that.popup.setContent(html);
          that.map.openPopup(that.popup);
        }
      });
      //that.map.addLayer(utfGrid);
      group.addLayer(utfGrid);
    }
  },
    
  error: function(jqXHR, textStatus, errorThrown) {
    if(opts.onError) {
      opts.onError(textStatus);
    }
  }
    
  });
  
  return group;
};



// Override some bits of Leaflet
L.Path.prototype._updateStyleBase = L.Path.prototype._updateStyle;
L.Path.prototype._updateStyle = function() {
  this._updateStyleBase();
	if (this.options.classes) {
	  this._path.setAttribute('class', this._path.getAttribute('class') + ' ' + this.options.classes);
  	//L.DomUtil.addClass(this._path, this.options.classes);
	}
};
L.Path.prototype._initEventsBase = L.Path.prototype._initEvents;
L.Path.prototype._initEvents = function() {
  this._initEventsBase();
  if (this.options.classes) {
	  this._path.setAttribute('class', this._path.getAttribute('class') + ' ' + this.options.classes);
    //L.DomUtil.addClass(this._path, this.options.classes);
  }
};



L.CircleMarker.prototype.setZIndexOffset = function() { };
L.CircleMarker.prototype._setPos = function() { };
L.CircleMarker.prototype.setOpacity = function(o) {
  //this._path.setAttribute('opacity', o);
};

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}



/* opts:
    map: leaflet map instance
    watch: true|false
    follow: true|false,  -- center map on me
    bounds: [ { lat, lon }, { lat, lon } ]  -- only center on me when with in these
*/

Paraffin.GPS = function(opts) {
  var marker = null;
  var circle = null;
  var compass = null;
  var lastPosition = null;
  var follow = (opts.follow == true);
  this.bounds = null;
  var that = this;
  
  var map = opts.map;
  if(!opts.map) {
    throw "You need to specify the 'map' property of the GPS options";
  }
  
  if(opts.bounds) {
    var southWest = new L.LatLng(opts.bounds[0].lat, opts.bounds[0].lon);
    var northEast = new L.LatLng(opts.bounds[1].lat, opts.bounds[1].lon);
    this.bounds = new L.LatLngBounds(southWest, northEast);
  }

  var foundLocation = function(position) {
    var ll = new L.LatLng(position.coords.latitude, position.coords.longitude);
    var heading = position.coords.heading;
    updateMarker(ll, heading);

    if(follow && that.bounds && that.bounds.contains(ll)) {
      if(!lastPosition) {
        // On first fix, zoom in close
        map.setZoom(16);
      }
      map.panTo(ll);
    }
    lastPosition = position.coords;
  };
  
  var noLocation = function() { if(opts.noLocation) opts.noLocation(); };
  
  var updateMarker = function(ll, heading) {
    if(!lastPosition && !ll) {
      return;
    }
    if(!ll) {
      var ll = new L.LatLng(lastPosition.latitude, lastPosition.longitude);
    }
    
    if(circle) {
      map.removeLayer(circle);
    }
    //circle = new L.Circle(ll, lastPosition.accuracy, { fillOpacity: 0.1 });
    //map.addLayer(circle);
    if(!marker) {
      marker = new L.Marker(ll);
      map.addLayer(marker);
    } else {
      marker.setLatLng(ll);
    }
    
    //heading = Date.now() % 360;
    if(typeof(heading) !== 'undefined' && heading !== null) {
      if(compass) {
        map.removeLayer(compass);
      }
      var fov = Math.PI / 4.0;
      var r = 0.01, theta = -heading * Math.PI / 180.0 + Math.PI/2.0;
      var cc = Math.cos(Math.PI * ll.lat / 180.0);
      var dx1 = r * Math.cos(theta+fov/2.0), dy1 = r * Math.sin(theta+fov/2.0) * cc;
      var dx2 = r * Math.cos(theta-fov/2.0), dy2 = r * Math.sin(theta-fov/2.0) * cc;
      
      var left = new L.LatLng(ll.lat + dy1, ll.lng + dx1);
      var right = new L.LatLng(ll.lat + dy2, ll.lng + dx2);
      compass = new L.Polyline([left, ll, right]);
      map.addLayer(compass);
      
    } else if(compass) {
      map.removeLayer(compass);
      compass = null;
    }
  };
  
  if(navigator.geolocation) {
    var locOptions = { enableHighAccuracy: true };
    if(opts.watch) {
      navigator.geolocation.getCurrentPosition(foundLocation, noLocation, locOptions);
      navigator.geolocation.watchPosition(foundLocation, noLocation, locOptions);
    } else {
      navigator.geolocation.getCurrentPosition(foundLocation, noLocation, locOptions);
    }
  }
  
  map.on('zoomend', function(e) {
    updateMarker(null);
  });
  
}



  
