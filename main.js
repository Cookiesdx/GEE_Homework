// Tạo biến chứa map hành chính toàn cầu (Global Administrative Unit Layers - GAUL)
var main_map = ee.FeatureCollection("FAO/GAUL/2015/level2");

// Lọc ra huyện Đông Anh - Hà Nội
// main_map.filter -> Áp dụng filter từ map chính
// ee.Filter.eq -> Filter metadata (Source: GEE docs)
// ADM2_NAME -> Filter tên quận huyện (Có các lớp từ ADM0->5, 0: Quốc gia, 1: Tỉnh, 2: Quận huyện...) (Source: https://www.geoboundaries.org/api.html)
var destination_map = main_map.filter(ee.Filter.eq("ADM2_NAME", 'Dong Anh'));

// Vẽ ranh giới huyện Đông Anh
// Style; fillcolor -> Màu tô bên trong ; color -> Màu ranh giới ; width -> độ to nét vẽ
var desmap_boundary = ee.FeatureCollection(destination_map).style({
  fillColor:'00000000',
  color: 'cyan',
  width: 1
});

// Render ranh giới
Map.centerObject(destination_map,10);
Map.addLayer(desmap_boundary,{}, "Ranh giới");

// Settings map
Map.setOptions('SATELLITE'); //https://developers.google.com/earth-engine/apidocs/map-setoptions


// Lọc mây cho Landsat8 (https://gis.stackexchange.com/questions/425159/how-to-make-a-cloud-free-composite-for-landsat-8-collection-2-surface-reflectanc)
function cloudFilter(image) {
  // Develop masks for unwanted pixels (fill, cloud, cloud shadow).
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);
  return image.updateMask(qaMask).updateMask(saturationMask);
}

// Applies scaling factors. (Landsat Example on GEE)
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

// Lấy hình ảnh từ Landsat 8 (2013-Present)
function getLandsat(year, region){
  var start_date = ee.Date.fromYMD(year,1,1);
  var end_date = ee.Date.fromYMD(year,12,31);
  
  var collection = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2") //https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC08_C02_T1_L2
    .filterBounds(region)
    .filterDate(start_date, end_date)
    .filter(ee.Filter.lt("CLOUD_COVER",50)) //Lấy ảnh có ít hơn 50% mây
    .map(cloudFilter)
    .map(applyScaleFactors)
    .median() // Tìm median 
    .set("year", year);
  return ee.Image(collection).clip(region); // Cắt phần cần dùng
  }

function calculateNDVI(image){
  var ndvi = image.normalizedDifference(["SR_B5", "SR_B4"])
                  .rename("NDVI")
                  .copyProperties(image, image.propertyNames());
  return ee.Image(ndvi)
}

//Hiển thị theo band 4 3 2 (Natural color)
var natural_Landsat = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0.0,
  max: 0.3,
};

//Hiển thị theo band 5 4 3 (Color Infrared)
var nir_Landsat = {
  bands: ['SR_B5','SR_B4','SR_B3'],
  min: 0.0,
  max: 0.3,
}

// Pallette màu ndvi
var ndviVis = {
    min: -0.2,
    max: 1,
    palette: [ // MODIS pallette
    '352ce3', 'ce7e45', 'df923d', 'f1b555', 'fcd163', '99b718', '74a901',
    '66a000', '529400', '3e8601', '207401', '056201', '004c00', '023b01',
    '012e01', '011d01', '011301'
  ],
}


// So sánh giữa 2 năm cho trước
var ndvi_compare1 = calculateNDVI(getLandsat(2015, destination_map))
var ndvi_compare2 = calculateNDVI(getLandsat(2025, destination_map))

var ndviChange = ndvi_compare2.subtract(ndvi_compare1).rename('NDVI_Change');
var changeVis = {
    min: -0.5,
    max: 0.5,
    palette: [
        '#8B0000', // đỏ đậm - giảm mạnh
        '#FF7F7F', // đỏ nhạt - giảm nhẹ
        '#FFFFFF', // trắng - trung tính
        '#7FFF7F', // xanh nhạt - tăng nhẹ
        '#006400'  // xanh đậm - tăng mạnh
    ]
};


//Chart
// function getStat(ndvi,year){
//   var stats = ndvi.reduceRegion({
//         reducer: ee.Reducer.minMax().combine({
//           reducer2: ee.Reducer.mean(),
//           sharedInputs: true
//         }),
//         geometry: destination_map.geometry(),
//         scale: 30,
//         maxPixels: 1e9
//       });
  
//       // Trả về một đối tượng Feature chứa các thống kê
//       return ee.Feature(null, {
//         year: year,
//         min: stats.get('NDVI_min'),
//         max: stats.get('NDVI_max'),
//         mean: stats.get('NDVI_mean')
//       })}

// Hiển thị :V
// var mergedStats = [];
Map.centerObject(destination_map,12); // Zoom 12
for (var year=2015; year<=2025; year++){
  var base_image = getLandsat(year, destination_map)
  // .setShown(0) -> Bỏ chọn, tăng tốc load
  Map.addLayer(base_image, natural_Landsat, "Natural - " + year).setShown(0);
  Map.addLayer(base_image, nir_Landsat, "NIR - " + year).setShown(0);
  var ndvi = calculateNDVI(base_image)
  Map.addLayer(ndvi, ndviVis, "NDVI - " + year).setShown(0);
  // mergedStats.push(getStat(ndvi,year));
}
Map.addLayer(ndviChange, changeVis, 'NDVI Changes 2015-2025').setShown(0);





