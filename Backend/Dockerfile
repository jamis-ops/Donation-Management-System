FROM php:8.2-apache

# Install system dependencies & PHP extensions (PDO MySQL, mbstring, curl, ssl)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_mysql mbstring gd \
    && a2enmod rewrite headers \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory to Apache web root
WORKDIR /var/www/html

# Copy backend codebase
COPY . /var/www/html/

# Create necessary upload & log directories and set permissions
RUN mkdir -p /var/www/html/api/uploads/donation_proofs \
             /var/www/html/api/uploads/profiles \
             /var/www/html/api/uploads/proofs \
             /var/www/html/api/uploads/volunteer_resumes \
             /var/www/html/api/logs/mail_outbox \
    && chown -R www-data:www-data /var/www/html/api/uploads /var/www/html/api/logs \
    && chmod -R 755 /var/www/html/api/uploads /var/www/html/api/logs

# Expose standard Apache port
EXPOSE 80

# Start Apache in foreground
CMD ["apache2-foreground"]
