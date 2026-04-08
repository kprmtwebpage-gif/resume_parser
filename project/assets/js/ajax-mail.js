$(function() {

	// Get the form.
	var form = $('#contact-form');

	// Get the messages div.
	var formMessages = $('.form-message');

	// Set up an event listener for the contact form.
	$(form).submit(function(e) {
		// Stop the browser from submitting the form.
		e.preventDefault();
		
		$('#contactBtn').attr('disabled', 'disabled');
		
		// Serialize the form data.
		var formData = $(form).serialize();
		
		// Submit the form using AJAX.
		$.ajax({
			type: 'POST',
			url: $(form).attr('action'),
			data: formData,
			dataType: 'html'
		})
		.done(function(response) {
			// Make sure that the formMessages div has the 'success' class.
			$(formMessages).removeClass('error');
			$(formMessages).addClass('success');
			
			if(response.includes("sent successfully")) {
				response = '<br/><div class="alert alert-success alert-dismissible">' +
							'<button type="button" class="btn-close" data-bs-dismiss="alert"></button>' +
							'<strong>Thanks for reaching out to us, will contact you soon</strong>' +
							'</div>';
			}
			else {
				response = '<br/><div class="alert alert-danger alert-dismissible">' +
							'<button type="button" class="btn-close" data-bs-dismiss="alert"></button>' +
							'<strong>Something went wrong during the submit</strong>' +
							'</div>';
			}

			// Set the message text.
			$(formMessages).html(response);
			
			setTimeout(()=>{
				window.location.reload();
			},4000);
		})
		.fail(function(data) {
			// Make sure that the formMessages div has the 'error' class.
			$(formMessages).removeClass('success');
			$(formMessages).addClass('error');

			// Set the message text.
			if (data.responseText !== '') {
				$(formMessages).html('<br/><div class="alert alert-danger alert-dismissible">' +
							'<button type="button" class="btn-close" data-bs-dismiss="alert"></button>' +
							'<strong>Something went wrong during the submit</strong>' +
							'</div>');
			} else {
				$(formMessages).text('Oops! An error occured and your message could not be sent.');
			}
			
			
			setTimeout(()=>{
				window.location.reload();
			},4000);
			
		});
	});

});