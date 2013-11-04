function get_blexted_properties(){
  $.get('http://sitecontrol.us/maps/241/list.json?token=EcUDYrJA4z1SYRjc1ymx&only_tagged=1', function(data){
    pm.map.addLayer(new L.GeoJSON(data, {
      style: function(feature) {
        return {color: feature.properties.dataset == 'snake' ? 'green' : 'blue', fillOpacity: '1'} 
      }  ,
            onEachFeature: function (feature, layer) {
              addy = (feature.properties.proaddress || feature.properties.address);
                layer.bindPopup("<b class='propaddy'>" + addy + "</b><br/><a href='#' class='btn use_parcel' data-dataset='"+feature.properties.dataset+"' data-id='" + feature.properties.fid + "'>Blext this property</a>");
            }
    }));
    return;
  });
}

function tag_property(name){
  options ={ 
     "token": 'EcUDYrJA4z1SYRjc1ymx', 
     "name": "tags", 
     "value":  name, 
     "append": 1,
     "pk": {
       "dataset": 'sitecontrol', 
       "id": property_id,
       "geoid": "26163",
       "county": "wayne", 
       "city": "detroit", 
       "state": "mi"}, 
      "map_id": map, "id": property_id}
      
  $.ajax({
   type: "POST",
   url: 'http://sitecontrol.us/maps/' + map + '/layers/' + layer + '.json',
   crossDomain: true,
   data: options, 
   dataType: "json",
   success: function(result){
     //alert('It worked!')
   },error : function() {
     alert('Sorry problem saving your answer. Try Again');
   }
 });
}

function reset(){
  get_blexted_properties();
  navigator.geolocation.getCurrentPosition(foundLocation, noLocation);
}

function add_to_property_computer(column, answer, dataset, map, layer){
  options = {
          token: 'EcUDYrJA4z1SYRjc1ymx',
           name: column,
          value: answer,
    "pk[state]": 'mi',
   "pk[county]": 'wayne',
     "pk[city]": 'detroit',
    "pk[geoid]": '26163',
  "pk[dataset]": dataset,
       "pk[id]": property_id
  }
  
  $.ajax({
     type: "POST",
     url: 'http://sitecontrol.us/maps/' + map + '/layers/' + layer + '.json',
     crossDomain: true,
     data: options, 
     dataType: "json",
     success: function(result){
       //alert('It worked!')
     },error : function() {
       alert('Sorry problem saving your answer. Try Again');
     }
   });
}

$(document).ready(function(){
  
  get_blexted_properties();
  
  $('.question').on('click', function(){
    column = $(this).data('column')
    answer = $(this).data('answer')
    dataset = 'sitecontrol'
    map = map
    layer = layer
    
    add_to_property_computer(column, answer, dataset, map, layer) 
  
    target = $(this).attr('href');
    
    //if ($(this).getAttribute('data-tag')){
    //  tag_property($(this).getAttribute('data-tag'));
    //}
  
    if (target == '#question2' || '#question6'){
      get_blexted_properties();
    }
  });
})