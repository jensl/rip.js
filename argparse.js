var NO_DEFAULT = {};

function Argument(short_name, long_name, destination, action, required,
                  default_value, constant_value) {
  this.shortName = short_name;
  this.longName = long_name;
  this.destination = destination;
  this.action = action;
  this.required = required;
  this.defaultValue = default_value;
  this.constantValue = constant_value;
}

function ArgumentParser() {
  this.all = [];
  this.shortOptions = {}
  this.longOptions = {}
  this.positionals = [];
}

ArgumentParser.prototype.addArgument = function () {
  var arguments_length = arguments.length;
  var options = {};

  if (arguments_length > 1) {
    var last_argument = arguments[arguments_length - 1];
    if (last_argument && typeof last_argument == "object") {
      options = last_argument;
      --arguments_length;
    }
  }

  var short_name = null;
  var long_name = null;
  var destination = null;
  var action = "store";
  var required = false;
  var default_value = NO_DEFAULT;
  var constant_value = null;

  for (var index = 0; index < arguments_length; ++index) {
    var argument = arguments[index];

    if (/^--/.test(argument)) {
      long_name = argument.substring(2);
      destination = long_name.replace(/-/g, "_");
    } else if (/^-/.test(argument)) {
      short_name = argument.substring(1);
    } else {
      destination = argument.replace(/-/g, "_");
    }
  }

  if ("destination" in options)
    destination = String(options.destination);
  if (action == "store_const") {
    if (!("constantValue" in options))
      throw Error("'constantValue' option required when action='store_const'");
    else
      constant_value = options.constantValue;
  }
  if ("action" in options) {
    action = String(options.action);

    switch (action) {
    case "store_true":
      action = "store_const";
      constant_value = true;
      break;
    case "store_false":
      action = "store_const";
      constant_value = false;
      break;
    case "store":
    case "store_const":
    case "append":
      break;
    default:
      throw Error(format("invalid 'action' option value: %r", action));
    }
  }
  if ("required" in options)
    required = Boolean(options.required);
  if ("defaultValue" in options) {
    if (action == "store")
      default_value = options.defaultValue;
    else
      throw Error("'defaultValue' option only supported when action='store'");
  }

  var argument = new Argument(short_name, long_name, destination, action,
                              required, default_value, constant_value);

  this.all.push(argument);

  if (short_name)
    this.shortOptions[short_name] = argument;
  if (long_name)
    this.longOptions[long_name] = argument;
  if (!short_name && !long_name)
    this.positionals.append(argument);
}

ArgumentParser.prototype.parseArguments = function () {
  var parser = this;
  var argv;

  if (arguments.length == 0)
    argv = OS.Process.argv;
  else
    argv = arguments;

  var result = {};

  this.all.forEach(
    function (argument) {
      if (argument.action == "store" && argument.defaultValue !== NO_DEFAULT)
        result[argument.destination] = argument.defaultValue;
    });

  var consumers = [];
  var positionals = this.positionals.slice();

  function processOption(option, name, value) {
    if (!option)
      throw Error(format("invalid option: '%s'", name));
    switch (option.action) {
    case "store":
      if (value)
        result[option.destination] = value;
      else
        consumers.push(option);
      break;

    case "store_const":
      if (value)
        throw Error(format("unexpected option value: %r", value));
      result[option.destination] = option.constantValue;
      break;

    case "append":
      if (value) {
        if (!(option.destination in result))
          result[option.destination] = [];
        result[option.destination].push(value);
      } else {
        consumers.push(option);
      }
    }
  }

  Array.prototype.forEach.call(argv, function (argument) {
    if (/^--/.test(argument)) {
      var name, value;
      var match = /^([^=]+)=(.*)$/.exec(argument);
      if (match)
        name = match[1], value = match[2];
      else
        name = argument, value = null;
      processOption(this.longOptions[name.substring(2)], name, value);
    } else if (/^-/.test(argument)) {
      argument.substring(1).split("").forEach(function (short_name) {
        processOption(parser.shortOptions[short_name], "-" + short_name);
      });
    } else {
      var consumer;
      if (consumers.length)
        consumer = consumers.shift();
      else
        consumer = positionals.unshift();
      if (consumer)
        processOption(consumer, null, argument);
      else
        throw Error(format("unexpected argument: %r", argument));
    }
  });

  return result;
}
