var fs = require("fs");
var readline = require("readline");
var google = require("googleapis");
var googleAuth = require("google-auth-library");

var SCOPES = ["https://www.googleapis.com/auth/drive"];
var TOKEN_DIR =
  (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) +
  "/.credentials/";
var TOKEN_PATH = TOKEN_DIR + "drive-nodejs-quickstart.json";

//TODO clean this up into an actual class

class DriveStorage {
  auth: any;

  // Load client secrets from a local file.
  startAuth(callback) {
    var self = this;

    //pull the secret in instead of reading the file
    var content = require("./js/client_secret.json");

    // Authorize a client with the loaded credentials, then call the
    // Drive API.
    self.authorize(content, function(oauth2Client) {
      console.log("authorization was good!", oauth2Client);

      self.auth = oauth2Client;
      callback();
    });
  }

  /**
     * Create an OAuth2 client with the given credentials, and then execute the
     * given callback function.
     *
     * @param {Object} credentials The authorization client credentials.
     * @param {function} callback The callback to call with the authorized client.
     */
  authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;

    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(
      clientId,
      clientSecret,
      "http://localhost:9004"
    );

    // Check if we have previously stored a token.
    var self = this;
    fs.readFile(TOKEN_PATH, function(err, token) {
      if (err) {
        self.getNewToken(oauth2Client, callback);
      } else {
        oauth2Client.credentials = JSON.parse(token);
        callback(oauth2Client);
      }
    });
  }

  /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     *
     * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
     * @param {getEventsCallback} callback The callback to call with the authorized
     *     client.
     */
  getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES
    });

    //opens the desired auth page
    var open = require("open");
    open(authUrl);

    var self = this;

    //need to spin up a server quickly here to accept the call back
    var http = require("http");
    var server = http.createServer(function(request, response) {
      response.end("You can close this window now.");

      //process the code that is sent in
      var url = require("url");

      oauth2Client.getToken(url.parse(request.url, true).query.code, function(
        err,
        token
      ) {
        if (err) {
          console.log("Error while trying to retrieve access token", err);
          return;
        }
        oauth2Client.credentials = token;
        self.storeToken(token);
        server.close(function() {
          console.log("server closed");
        });

        //TODO clean this up
        callback(oauth2Client);
      });
    });

    server.listen(9004);
    console.log("Server is listening");

    //TODO need a check down here to make sure that things don't stay open too long
  }

  /**
     * Store token to disk be used in later program executions.
     *
     * @param {Object} token The token to store to disk.
     */
  storeToken(token) {
    try {
      fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
      if (err.code !== "EEXIST") {
        throw err;
      }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log("Token stored to " + TOKEN_PATH);
  }

  /**
     * Lists the names and IDs of up to 10 files.
     *
     * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
     */
  listFiles(callback) {
    var self = this;
    var service = google.drive({
      version: "v3",
      auth: self.auth
    });
    service.files.list(
      {
        pageSize: 10,
        q: "mimeType='text/tasklist'",
        fields: "nextPageToken, files(id, name)"
      },
      function(err, response) {
        if (err) {
          console.log("The API returned an error: " + err);
          return;
        }
        var files = response.files;
        if (files.length === 0) {
          console.log("No files found.");
        } else {
          console.log("Files", files);
          //fire back control
          callback(files);
        }
      }
    );
  }

  storeFile(contents, fileName, fileId, callback) {
    var self = this;

    var drive = google.drive({
      version: "v3",
      auth: self.auth
    });

    fileName = fileName + ".json";

    if (fileId === undefined) {
      //new file to create
      drive.files.create(
        {
          resource: {
            name: fileName,
            mimeType: "text/tasklist"
          },
          media: {
            mimeType: "text/plain",
            body: contents
          }
        },
        function(err, file) {
          if (err) {
            // Handle error
            console.log(err);
          } else {
            console.log("File Id:", file.id);
            callback(file.id);
            //TODO need to return this back to the TaskList
          }
        }
      );
    } else {
      drive.files.update(
        {
          resource: {
            name: fileName,
            mimeType: "text/tasklist"
          },
          fileId: fileId,
          media: {
            mimeType: "text/plain",
            body: contents
          }
        },
        function(err, file) {
          if (err) {
            // Handle error
            console.log(err);
          } else {
            console.log("File Id:", file.id);
            callback(fileId);
            //TODO need to return this back to the TaskList
          }
        }
      );
    }
  }

  downloadFile(file, callback) {
    var fileId = file.id;
    var fileName = file.name;

    var path = "./tmp/" + fileName;
    var self = this;

    console.log("try to download", fileId);

    var drive = google.drive({
      version: "v3",
      auth: self.auth
    });

    var dest = fs.createWriteStream(path);
    drive.files
      .get({
        fileId: fileId,
        alt: "media"
      })
      .on("end", function() {
        console.log("Done");
        callback(path);
      })
      .on("error", function(err) {
        console.log("Error during download", err);
      })
      .pipe(dest);
  }
}
