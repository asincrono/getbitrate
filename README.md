# getbitrate

getbitrate is a javascript program that runs under Nodejs and shows the received
by the network interface provided.

It uses minimist to parse the command line arguments

## Installation

    git clone https://github.com/asincrono/getbitrate.git
    npm install

## Run

Example:

    node main.js -d en1 -r ftp://192.168.1.1/ftp/file.data -a login:password -o bitrate.txt -t 5 -n 100

This command will start to download `file.data` and show the bitrate ever 5
seconds (-t 5) 100 times (-n 100) and save the values to the file `bitrate.txt`

The results will be saved in the form:

    [timestamp in milliseconds] [bytes received]  [bitrate in B/s]

## Command line arguments

*   -d (--device): followed by the name of the device which bitrate is to be show.
*   -r (--resource): the resource to be downloaded in order to check the bitrate.
*   -o (--output): the name of the file where to save the bitrate information
*   -a (--autenticate): to supply _&lt;login&gt;_:_&lt;password&gt;_ if needed.
*   -t (--time): time in seconds between bitrate checks.
*   -n (--readings): number of bitrate readings to be done.
*   -p (--precission): number of decimals to be shown.
