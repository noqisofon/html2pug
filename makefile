.PHONY : build
build:
	lsc --no-header -b -c ./lib/html2pug.ls
	lsc --no-header -b -c ./test/test-cmd.ls
