package in.srcenterprises.api;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.List;
@Configuration
public class SecurityConfig {
  @Bean PasswordEncoder encoder(){return new BCryptPasswordEncoder();}
  @Bean UserDetailsService users(@Value("${src.admin.username}") String username,@Value("${src.admin.password}") String password,PasswordEncoder encoder){
    if(username.isBlank()||password.length()<16) throw new IllegalStateException("Set SRC_ADMIN_USERNAME and a strong SRC_ADMIN_PASSWORD (16+ chars)");
    return new InMemoryUserDetailsManager(User.withUsername(username).password(encoder.encode(password)).roles("ADMIN").build());
  }
  @Bean SecurityFilterChain security(HttpSecurity http,@Value("${src.cors.origin}") String origin) throws Exception {
    var cors=new CorsConfiguration();cors.setAllowedOrigins(List.of(origin));cors.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));cors.setAllowedHeaders(List.of("Authorization","Content-Type"));cors.setAllowCredentials(false);
    var source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/api/**",cors);
    return http.cors(x->x.configurationSource(source))
      .csrf(csrf->csrf.disable()) // Stateless API with Basic auth; replace with session/JWT+CSRF design before browser user logins
      .authorizeHttpRequests(a->a.requestMatchers("/actuator/health").permitAll()
         .requestMatchers(HttpMethod.GET,"/api/catalog/**").permitAll()
         .requestMatchers("/api/admin/**").hasRole("ADMIN")
         .anyRequest().denyAll())
      .httpBasic(Customizer.withDefaults()).build();
  }
}
