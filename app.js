var fs = require('fs');
var path = require('path');
var xml2js = require('xml2js');
var parseString = require('xml2js').parseString;
var argv = require('minimist')(process.argv.slice(2));

var Config = {
	ViewerHTML: path.join(__dirname, 'index.html'),
	LiveMPDFile: 'live.mpd',
	PlaybackMPDFile: 'playback.mpd',
	SegmentDuration: 4000
}

function getRecordingDirectories(wd) {
	return fs.readdirSync(wd).filter(function(file) {
		return file.match(/^recording_\d+$/) &&
			fs.statSync(path.join(wd, file)).isDirectory();
	});
}

function getSegmentCount(wd, quality) {
	return fs.readdirSync(wd).filter(function(file) {
		return file.match(new RegExp('^live_video_' + quality + '_\\d+.m4s$'));
	}).length;
}

function getMpdXml(path, callback) {
	fs.readFile(path, 'utf-8', function (err, data) {
		if (err) console.log(err);
		
		parseString(data, function (err, result) {
			if (err) console.log(err);
			
			callback(result);
		});
	});
}

function updateStreamType(mpdxml, type) {
	mpdxml['MPD']['$']['type'] = type;
	return mpdxml;
}

function removeBaseUrl(mpdxml) {
	delete mpdxml['MPD']["BaseURL"];
	return mpdxml;
}

function setPresentationDuration(mpdxml, duration) {
	mpdxml['MPD']['$']['mediaPresentationDuration'] = duration;
	return mpdxml;
}

function createViewer(wd) {
	fs.createReadStream(Config.ViewerHTML).pipe(fs.createWriteStream(path.join(wd, path.basename(Config.ViewerHTML))));
	console.log('Created: ' + path.join(wd, path.basename(Config.ViewerHTML)));
}

function setupDirectory(wd, segments) {
	createViewer(wd);
	
	getMpdXml(path.join(wd, 'live.mpd'), function (mpdxml) {
		mpdxml = updateStreamType(mpdxml, 'static');
		mpdxml = removeBaseUrl(mpdxml);

		var duration = new Date(Config.SegmentDuration * segments);
		mpdxml = setPresentationDuration(mpdxml, 'PT' + duration.getHours() + 'H' + duration.getMinutes() + 'M' + duration.getSeconds() + '.' + duration.getMilliseconds() + 'S');
		
		var builder = new xml2js.Builder();
		var xml = builder.buildObject(mpdxml);
		
		fs.writeFile(path.join(wd, Config.PlaybackMPDFile), xml, function(err, data) {
			if (err){
				console.log(err);
			} else {
				console.log('Created: ' + path.join(wd, Config.PlaybackMPDFile));
			}
		});
	});
}

var directories = getRecordingDirectories(argv.path);

for (var index in directories) {
	var segments = getSegmentCount(path.join(argv.path, directories[index]), argv.quality);
	setupDirectory(path.join(argv.path, directories[index]), segments);
}
