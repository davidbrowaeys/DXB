# summary

Check the quality of a junit test result and flags anything slower than defined threshold

# examples

- Specify an existing JUnit XML file
  
  <%= config.bin %> <%= command.id %> --junit-path tests/junit.xml

# flags.junit-path.summary

Path of junit xml file

# flags.time-threshold.summary

Maximum amount of time that a test method should take to execute (in second).

# flags.flag-as-error.summary

if set, the command will update add failure tags to junit file and throw an error

# log.slowUnitTest

Some unit test have been identified below the standard %ss

# error.performance.tooSlow

DXB.PerformanceException: Test method is too slow

# error.performance

DXB.PerformanceException

# error.invalidSOQL

Invalid SOQL query format
