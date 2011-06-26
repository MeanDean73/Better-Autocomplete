/**
 * Better Autocomplete jQuery plugin.
 * Create or alter an autocomplete object instance to every text input
 * element in the selection.
 *
 * @author Didrik Nordström, http://betamos.se/
 *
 * @requires
 *   <ul><li>
 *   jQuery 1.4+
 *   </li><li>
 *   a modern web browser (not tested in IE)
 *   </li></ul>
 *
 * @constructor
 *
 * @name jQuery.betterAutocomplete
 *
 * @param {String} method
 *   Should be one of the following:
 *   <ul><li>
 *     init: Initiate Better Autocomplete instances on the text input elements
 *     in the current jQuery selection. They are enabled by default. The other
 *     parameters are then required.
 *   </li><li>
 *     enable: In this jQuery selection, reenable the Better Autocomplete
 *     instances.
 *   </li><li>
 *     disable: In this jQuery selection, disable the Better Autocomplete
 *     instances.
 *   </li><li>
 *     destroy: In this jQuery selection, destroy the Better Autocomplete
 *     instances. It will not be possible to reenable them after this.
 *   </li></ul>
 *
 * @param {String|Object} [resource]
 *   If String, it will become the path for a remote resource. If not, it will
 *   be treated like a local resource. The path should provide JSON objects
 *   upon HTTP requests.
 *
 * @param {Object} [options]
 *   An object with configurable options:
 *   <ul><li>
 *     charLimit: (default=3) The minimum number of chars to do an AJAX call.
 *     A typical use case for this limit is to reduce server load.
 *   </li><li>
 *     delay: (default=350) The time in ms between last keypress and AJAX call.
 *     Typically used to prevent looking up irrelevant strings while the user
 *     is still typing.
 *   </li><li>
 *     maxHeight: (default=330) The maximum height in pixels for the
 *     autocomplete list.
 *   </li><li>
 *     remoteTimeout: (default=10000) The timeout for remote (AJAX) calls.
 *   </li><li>
 *     selectKeys: (default=[9, 13]) The key codes for keys which will select
 *     the current highlighted element. The defaults are tab, enter.
 *   </li></ul>
 *
 * @param {Object} [callbacks]
 *   An object containing optional callback functions on certain events. See
 *   {@link callbacks} for details. These callbacks should be used when
 *   customization of the default behavior of Better Autocomplete is required.
 *
 * @returns {Object}
 *   The jQuery object with the same element selection, for chaining.
 */

(function ($) {

$.fn.betterAutocomplete = function(method) {

  /*
   * Each method expects the "this" object to be a valid DOM text input node.
   * The methods "enable", "disable" and "destroy" expects an instance of a
   * BetterAutocomplete object as their first argument.
   */
  var methods = {
    init: function(resource, options, callbacks) {
      var $input = $(this),
        bac = new BetterAutocomplete($input, resource, options, callbacks);
      $input.data('better-autocomplete', bac);
      bac.enable();
    },
    enable: function(bac) {
      bac.enable();
    },
    disable: function(bac) {
      bac.disable();
    },
    destroy: function(bac) {
      bac.destroy();
    }
  };

  var args = Array.prototype.slice.call(arguments, 1);

  // Method calling logic
  this.filter(':input[type=text]').each(function() {
    switch (method) {
    case 'init':
      methods[method].apply(this, args);
      break;
    case 'enable':
    case 'disable':
    case 'destroy':
      var bac = $(this).data('better-autocomplete');
      if (bac instanceof BetterAutocomplete) {
        methods[method].call(this, bac);
      }
      break;
    default:
      $.error('Method ' +  method + ' does not exist in jQuery.betterAutocomplete.');
    }
  });

  // Maintain chainability
  return this;
};

/**
 * The BetterAutocomplete constructor function. Returns a BetterAutocomplete
 * instance object.
 *
 * @private @constructor
 * @name BetterAutocomplete
 *
 * @param $input
 *   A single input element wrapped in jQuery
 */
var BetterAutocomplete = function($input, resource, options, callbacks) {

  options = $.extend({
    charLimit: 3,
    delay: 350, // milliseconds
    maxHeight: 330, // px
    remoteTimeout: 10000, // milliseconds
    selectKeys: [9, 13] // [tab, enter]
  }, options);

  /**
   * These callbacks are supposed to be overridden by you when you need
   * customization of the default behavior. When you are overriding a callback
   * function, it is a good idea to copy the source code from the default
   * callback function, as a skeleton.
   *
   * @name callbacks
   * @namespace
   */
  callbacks = $.extend(
  /**
   * @lends callbacks.prototype
   */
  {

    /**
     * Gets fired when the user selects a result by clicking or using the
     * keyboard to select an element.
     *
     * <br /><br /><em>Default behavior: Simply blurs the input field.</em>
     *
     * @param {Object} result
     *   The result object that was selected.
     */
    select: function(result) {
      $input.blur();
    },

    /**
     * Given a result object, theme it to HTML.
     *
     * <br /><br /><em>Default behavior: Wraps result.title in an h4 tag, and
     * result.description in a p tag. Note that no sanitization of malicious
     * scripts is done here. Whatever is within the title/description is just
     * printed out. May contain HTML.</em>
     *
     * @param {Object} result
     *   The result object that should be rendered.
     *
     * @returns {String}
     *   HTML output, will be wrapped in a list element.
     */
    themeResult: function(result) {
      var output = '';
      if ($.type(result.title) == 'string') {
        output += '<h4>' + result.title + '</h4>';
      }
      if ($.type(result.description) == 'string') {
        output += '<p>' + result.description + '</p>';
      }
      return output;
    },

    /**
     * Retrieve local results from the local resource by providing a query
     * string.
     *
     * <br /><br /><em>Default behavior: Automatically handles arrays, if the
     * data inside each element is either a plain string or a result object.
     * If it is a result object, it will match the query string against the
     * title and description property. Search is not case sensitive.</em>
     *
     * @param {String} query
     *   The query string, unescaped. May contain any UTF-8 character.
     *
     * @param {Object} resource
     *   The resource provided in the {@link jQuery.betterAutocomplete} init
     *   constructor.
     *
     * @return {Array}
     *   A flat array containing pure result objects. Must return an array.
     */
    queryLocalResults: function(query, resource) {
      if (!$.isArray(resource)) {
        // Per default Better Autocomplete only handles arrays of data
        return [];
      }
      query = query.toLowerCase();
      var results = [];
      $.each(resource, function(i, value) {
        switch ($.type(value)) {
        case 'string': // Flat array of strings
          if (value.toLowerCase().indexOf(query) >= 0) {
            // Match found
            results.push({ title: value });
          }
          break;
        case 'object': // Array of result objects
          if ($.type(value.title) == 'string' && value.title.toLowerCase().indexOf(query) >= 0) {
            // Match found in title field
            results.push(value);
          }
          else if ($.type(value.description) == 'string' && value.description.toLowerCase().indexOf(query) >= 0) {
            // Match found in description field
            results.push(value);
          }
          break;
        }
      });
      return results;
    },

    /**
     * Fetch remote result data and return it using completeCallback when
     * fetching is finished. Must be asynchronous in order to not freeze the
     * Better Autocomplete instance.
     *
     * <br /><br /><em>Default behavior: Fetches JSON data from the url, using
     * the jQuery.ajax() method. Errors are ignored.</em>
     *
     * @param {String} url
     *   The URL to fetch data from.
     *
     * @param {Function} completeCallback
     *   This function must be called, even if an error occurs. It takes zero
     *   or one parameter: the data that was fetched.
     *
     * @param {Number} timeout
     *   The preferred timeout for the request. This callback should respect
     *   the timeout.
     */
    fetchRemoteData: function(url, completeCallback, timeout) {
      $.ajax({
        url: url,
        dataType: 'json',
        timeout: timeout,
        success: function(data, textStatus) {
          completeCallback(data);
        },
        error: function(jqXHR, textStatus, errorThrown) {
          completeCallback();
        }
      });
    },

    /**
     * Process remote fetched data by extracting an array of result objects
     * from it. This callback is useful if the fetched data is not the plain
     * results array, but a more complicated object which does contain results.
     *
     * <br /><br /><em>Default behavior: If the data is defined and is an
     * array, return it. Otherwise return an empty array.</em>
     *
     * @param {mixed} data
     *   The raw data recieved from the server. Can be undefined.
     *
     * @returns {Array[Object]}
     *   A flat array containing result objects. Must return an array.
     */
    processRemoteData: function(data) {
      if ($.isArray(data)) {
        return data;
      }
      else {
        return [];
      }
    },

    /**
     * From a given result object, return it's group name (if any). Used for
     * grouping results together.
     *
     * <br /><br /><em>Default behavior: If the result has a "group" property
     * defined, return it.</em>
     *
     * @param {Object} result
     *   The result object.
     *
     * @returns {String}
     *   The group name. If no group, don't return anything.
     */
    getGroup: function(result) {
      if ($.type(result.group) == 'string') {
        return result.group;
      }
    },

    /**
     * Called when remote fetching begins.
     *
     * <br /><br /><em>Default behavior: Adds the CSS class "fetching" to the
     * input field, for styling purposes.</em>
     */
    beginFetching: function() {
      $input.addClass('fetching');
    },

    /**
     * Called when fetching is finished. All active requests must finish before
     * this function is called.
     *
     * <br /><br /><em>Default behavior: Removes the "fetching" class.</em>
     */
    finishFetching: function() {
      $input.removeClass('fetching');
    },

    /**
     * Construct the remote fetching URL.
     *
     * <br /><br /><em>Default behavior: Adds "?q=query" to the path. The query
     * string is URL encoded.</em>
     *
     * @param {String} path
     *   The path given in the {@link jQuery.betterAutocomplete} constructor.
     *
     * @param {String} query
     *   The raw query string. Remember to URL encode this to prevent illegal
     *   character errors.
     *
     * @returns {String}
     *   The URL, ready for fetching.
     */
    constructURL: function(path, query) {
      return path + '?q=' + encodeURIComponent(query);
    }
  }, callbacks);

  var self = this,
    lastRenderedQuery = '',
    results = {}, // Key-valued caching of search results
    timer, // Used for options.delay
    activeRemoteCalls = 0,
    disableMouseHighlight = false,
    inputEvents = {},
    isLocal = ($.type(resource) != 'string');

  var $results = $('<ul />')
    .addClass('better-autocomplete')
    .insertAfter($input);

  $results.width($input.outerWidth() - 2) // Subtract border width.
    .css({
      maxHeight: options.maxHeight + 'px',
      left: $results.position().left + $input.offset().left,
      top: $results.position().top + $input.offset().top + $input.outerHeight()
    });

  inputEvents.focus = function() {
    redraw(true);
  };

  inputEvents.blur = function() {
    redraw();
  };

  inputEvents.keydown = function(event) {
    var index;
    // If an arrow key is pressed and a result is highlighted
    if ([38, 40].indexOf(event.keyCode) >= 0 && (index = getHighlighted()) >= 0) {
      var newIndex,
        size = $('.result', $results).length;
      switch (event.keyCode) {
      case 38: // Up arrow
        newIndex = Math.max(0, index-1);
        break;
      case 40: // Down arrow
        newIndex = Math.min(size-1, index+1);
        break;
      }
      // Index have changed so update highlighted element, then cancel the event.
      if ($.type(newIndex) == 'number') {

        // Disable the auto-triggered mouseover event
        disableMouseHighlight = true;

        setHighlighted(newIndex, true);

        return false;
      }
    }
    else if (options.selectKeys.indexOf(event.keyCode) >= 0) {
      // Only hijack the event if selecting is possible or pending action.
      if (select() || activeRemoteCalls >= 1 || timer !== null) {
        return false;
      }
      else {
        return true;
      }
    }
  };

  inputEvents.keyup = function() {
    var query = $input.val();
    clearTimeout(timer);
    // Indicate that timer is inactive
    timer = null;
    redraw();
    if (query.length >= options.charLimit && !$.isArray(results[query])) {
      // Fetching is required
      $results.empty();
      if (isLocal) {
        fetchResults($input.val());
      }
      else {
        timer = setTimeout(function() {
          fetchResults($input.val());
          timer = null;
        }, options.delay);
      }
    }
  };

  $('.result', $results[0]).live({
    // When the user hovers a result with the mouse, highlight it.
    mouseover: function() {
      if (disableMouseHighlight) {
        return;
      }
      setHighlighted($('.result', $results).index($(this)));
    },
    mousemove: function() {
      // Enable mouseover again.
      disableMouseHighlight = false;
    },
    mousedown: function() {
      select();
      return false;
    }
  });

  // Prevent blur when clicking on group titles, scrollbars etc.,
  // This event is triggered after the others' because of bubbling order.
  $results.mousedown(function() {
    return false;
  });

  /*
   * PUBLIC METHODS
   */

  /**
   * Enable this instance.
   */
  this.enable = function() {
    // Turn off the browser's autocompletion
    $input
      .attr('autocomplete', 'OFF')
      .attr('aria-autocomplete', 'list');
    $input.bind(inputEvents);
  };

  /**
   * Disable this instance.
   */
  this.disable = function() {
    $input
      .removeAttr('autocomplete')
      .removeAttr('aria-autocomplete');
    $results.hide();
    $input.unbind(inputEvents);
  };

  /**
   * Disable and remove this instance. This instance should not be reused.
   */
  this.destroy = function() {
    $results.remove();
    $input.unbind(inputEvents);
    $input.removeData('better-autocomplete');
  };

  /*
   * PRIVATE METHODS
   */

  /**
   * Set highlight to a specific result item
   *
   * @param {Number} index
   *   The result's index, starting on 0
   *
   * @param {Boolean} autoScroll
   *   If scrolling of the results list should be automated. (default=false)
   */
  var setHighlighted = function(index, autoScroll) {
    // Scrolling upwards
    var up = index == 0 || index < getHighlighted();
    var $scrollTo = $('.result', $results)
      .removeClass('highlight')
      .eq(index).addClass('highlight');

    if (!autoScroll) {
      return;
    }
    // Scrolling up, then make sure to show the group title
    if ($scrollTo.prev().is('.group') && up) {
      $scrollTo = $scrollTo.prev();
    }
    // Is $scrollTo partly above the visible region?
    if ($scrollTo.position().top < 0) {
      $results.scrollTop($scrollTo.position().top + $results.scrollTop());
    }
    // Or is it partly below the visible region?
    else if (($scrollTo.position().top + $scrollTo.outerHeight()) > $results.height()) {
      $results.scrollTop($scrollTo.position().top + $results.scrollTop() + $scrollTo.outerHeight() - $results.height());
    }
  };

  /**
   * Retrieve the index of the currently highlighted result item
   *
   * @return
   *   The result's index or -1 if no result is highlighted
   */
  var getHighlighted = function() {
    return $('.result', $results).index($('.result.highlight', $results));
  };

  /**
   * Select the current highlighted element
   *
   * @return
   *   True if a selection was possible
   */
  var select = function() {
    var $result = $('.result', $results).eq(getHighlighted());
    if (!$result.length) {
      return false;
    }
    var result = $result.data('result');

    callbacks.select(result);

    // Redraw again, if the callback changed focus or content
    redraw();
    return true;
  };

  /**
   * Fetch results asynchronously via AJAX.
   * Errors are ignored.
   *
   * @param query
   *   The query string
   */
  var fetchResults = function(query) {
    // Synchronously fetch local data
    if (isLocal) {
      results[query] = callbacks.queryLocalResults(query, resource);
      redraw();
    }
    // Asynchronously fetch remote data
    else {
      activeRemoteCalls++;
      var url = callbacks.constructURL(resource, query);
      callbacks.beginFetching();
      callbacks.fetchRemoteData(url, function(data) {
        var searchResults = callbacks.processRemoteData(data);
        if (!$.isArray(searchResults)) {
          searchResults = [];
        }
        results[query] = searchResults;
        activeRemoteCalls--;
        if (activeRemoteCalls == 0) {
          callbacks.finishFetching();
        }
        redraw();
      }, options.remoteTimeout);
    }
  };

  /**
   * Redraws the autocomplete list based on current query and focus.
   *
   * @param {Boolean} focus
   *   Force to treat the input element like it's focused.
   */
  var redraw = function(focus) {
    var query = $input.val();

    // The query does not exist in db
    if (!$.isArray(results[query])) {
      lastRenderedQuery = null;
      $results.empty();
    }
    // The query exists and is not already rendered
    else if (lastRenderedQuery !== query) {
      lastRenderedQuery = query;
      renderResults(results[query]);
      setHighlighted(0, true);
    }
    // Finally show/hide based on focus and emptiness
    // TODO: ScrollTop is reset to 0 when it's hidden. Maybe wrapper is needed anyway?
    if (($input.is(':focus') || focus) && !$results.is(':empty')) {
      $results.show();
    }
    else {
      $results.hide();
    }
  };

  /**
   * Regenerate the DOM content within the results list for a given set of
   * results. Heavy method, use only when necessary.
   *
   * @param {Array} results
   *   An array of result objects to render.
   */
  var renderResults = function(results) {
    $results.empty();
    var groups = {}; // Key is the group name, value is the heading element.

    $.each(results, function(index, result) {
      if ($.type(result) != 'object') {
        return; // Continue
      }

      var output = callbacks.themeResult(result);
      if ($.type(output) != 'string') {
        return; // Continue
      }

      // Add the group if it doesn't exist
      group = callbacks.getGroup(result);
      if ($.type(group) == 'string' && !groups[group]) {
        var $groupHeading = $('<li />').addClass('group')
          .append('<h3>' + group + '</h3>')
          .appendTo($results);
        groups[group] = $groupHeading;
      }

      var $result = $('<li />').addClass('result')
        .append(output)
        .data('result', result) // Store the result object on this DOM element
        .addClass(result.addClass);

      // First groupless item
      if ($.type(group) != 'string' && !$results.children().first().is('.result')) {
        $results.prepend($result);
        return; // Continue
      }
      var $traverseFrom = ($.type(group) == 'string') ? groups[group] : $results.children().first();
      var $target = $traverseFrom.nextUntil('.group').last();
      $result.insertAfter($target.length ? $target : $traverseFrom);
    });
  };
};

/*
 * jQuery focus selector, required by Better Autocomplete.
 *
 * @see http://stackoverflow.com/questions/967096/using-jquery-to-test-if-an-input-has-focus/2684561#2684561
 */
var filters = $.expr[':'];
if (!filters.focus) {
  filters.focus = function(elem) {
    return elem === document.activeElement && (elem.type || elem.href);
  };
}

})(jQuery);
