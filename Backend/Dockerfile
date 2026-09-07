FROM php:8.2-apache

# Install PDO MySQL and curl extensions
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache mod_rewrite & headers
RUN a2enmod rewrite headers

# Configure Apache DocumentRoot to api directory
ENV APACHE_DOCUMENT_ROOT /var/www/html/api
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Allow .htaccess overrides and CORS headers
RUN echo "<Directory /var/www/html/api>\n\
    Options Indexes FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>" > /etc/apache2/conf-available/api-override.conf \
    && a2enconf api-override

# Copy backend files
COPY . /var/www/html/

# Permissions for upload folders
RUN mkdir -p /var/www/html/api/uploads/donation_proofs /var/www/html/api/uploads/volunteer_resumes /var/www/html/api/logs \
    && chown -R www-data:www-data /var/www/html/api/uploads /var/www/html/api/logs \
    && chmod -R 775 /var/www/html/api/uploads /var/www/html/api/logs

EXPOSE 80
CMD ["apache2-foreground"]
