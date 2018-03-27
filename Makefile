TAP=./node_modules/.bin/tap

tap:
	$(TAP) test/unit/*.js

test: tap

server:
	node server.js

install:
	npm install

.PHONY: install server test
